#!/usr/bin/env python3
"""
WhatsApp Support Monitor — Etudesk Autonomous Agent
Monitors WhatsApp support activity, generates stats, and alerts on anomalies.
The actual bot logic lives in the Node.js backend (whatsapp-assistant.service.ts).
This script provides monitoring, reporting, and escalation.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta

DB_CMD_PREFIX = [
    "psql", "-h", "localhost", "-U", "etudesk", "-d", "etudesk-db",
    "-t", "-A", "--no-psqlrc",
]
LOG_FILE = "/var/log/etudesk-agent/whatsapp-monitor.log"
ULTRAMSG_INSTANCE = os.getenv("ULTRAMSG_INSTANCE_ID", "instance155775")
ULTRAMSG_TOKEN = os.getenv("ULTRAMSG_TOKEN", "jmlgm4fif6omu40i")


def db_query(sql: str) -> str:
    env = os.environ.copy()
    env["PGPASSWORD"] = "R2I7E3b5l6N9z5z"
    result = subprocess.run(
        DB_CMD_PREFIX + ["-c", sql],
        capture_output=True, text=True, env=env, timeout=10,
    )
    return result.stdout.strip()


def log(msg: str):
    ts = datetime.now(tz=__import__('datetime').timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except OSError:
        pass


def get_message_stats(hours: int = 24) -> dict:
    """Get WhatsApp support message statistics."""
    sql = f"""
    SELECT
        COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound,
        COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'sent') AS sent,
        COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed') AS failed,
        COUNT(DISTINCT phone_e164) AS unique_contacts
    FROM whatsapp_support_messages
    WHERE created_at > NOW() - INTERVAL '{hours} hours';
    """
    row = db_query(sql)
    if not row:
        return {"inbound": 0, "sent": 0, "failed": 0, "unique_contacts": 0}
    parts = row.split("|")
    return {
        "inbound": int(parts[0] or 0),
        "sent": int(parts[1] or 0),
        "failed": int(parts[2] or 0),
        "unique_contacts": int(parts[3] or 0),
    }


def get_open_reports() -> list[dict]:
    """Get unresolved support reports."""
    sql = """
    SELECT phone_e164, category, priority, status,
           LEFT(message_text, 100) AS excerpt,
           created_at::text
    FROM whatsapp_support_reports
    WHERE status IN ('NEW', 'IN_REVIEW')
    ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                       WHEN 'medium' THEN 2 ELSE 3 END,
        created_at DESC
    LIMIT 20;
    """
    rows = db_query(sql)
    if not rows:
        return []
    reports = []
    for line in rows.strip().split("\n"):
        parts = line.split("|")
        if len(parts) >= 6:
            reports.append({
                "phone": parts[0],
                "category": parts[1],
                "priority": parts[2],
                "status": parts[3],
                "excerpt": parts[4],
                "created_at": parts[5],
            })
    return reports


def get_hourly_rate() -> int:
    """Get outbound messages sent in the last hour (rate limit check)."""
    sql = """
    SELECT COUNT(*) FROM whatsapp_support_messages
    WHERE direction = 'outbound' AND status = 'sent'
      AND created_at > NOW() - INTERVAL '1 hour';
    """
    return int(db_query(sql) or 0)


def check_ultramsg_status() -> dict:
    """Check UltraMSG instance status via API."""
    try:
        import urllib.request
        url = f"https://api.ultramsg.com/{ULTRAMSG_INSTANCE}/instance/status?token={ULTRAMSG_TOKEN}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e)}


def generate_report():
    """Generate a full monitoring report."""
    log("=== WhatsApp Support Monitor Report ===")

    # Message stats
    stats_24h = get_message_stats(24)
    stats_1h = get_message_stats(1)
    log(f"Messages 24h: {stats_24h['inbound']} in / {stats_24h['sent']} sent / {stats_24h['failed']} failed / {stats_24h['unique_contacts']} contacts")
    log(f"Messages 1h:  {stats_1h['inbound']} in / {stats_1h['sent']} sent / {stats_1h['failed']} failed")

    # Rate limit check
    hourly_rate = get_hourly_rate()
    if hourly_rate > 50:
        log(f"WARNING: Approaching rate limit — {hourly_rate}/60 messages this hour")
    else:
        log(f"Rate: {hourly_rate}/60 messages this hour — OK")

    # Open reports
    reports = get_open_reports()
    critical = [r for r in reports if r["priority"] in ("critical", "high")]
    log(f"Open reports: {len(reports)} total, {len(critical)} critical/high priority")
    for r in critical:
        log(f"  [{r['priority'].upper()}] {r['phone']} — {r['category']}: {r['excerpt'][:60]}...")

    # Failure rate
    if stats_24h["sent"] + stats_24h["failed"] > 0:
        fail_rate = stats_24h["failed"] / (stats_24h["sent"] + stats_24h["failed"]) * 100
        if fail_rate > 10:
            log(f"WARNING: High failure rate — {fail_rate:.1f}%")
        else:
            log(f"Failure rate: {fail_rate:.1f}% — OK")

    # UltraMSG status
    status = check_ultramsg_status()
    if "error" in status:
        log(f"UltraMSG status: ERROR — {status['error']}")
    else:
        log(f"UltraMSG status: {json.dumps(status)}")

    # Bot enabled check
    try:
        import urllib.request
        with urllib.request.urlopen("http://localhost:3000/api/v1/whatsapp/webhook", timeout=5) as resp:
            data = json.loads(resp.read().decode())
            enabled = data.get("assistantEnabled", False)
            log(f"Bot status: {'ENABLED' if enabled else 'DISABLED'}")
    except Exception as e:
        log(f"Bot status: UNREACHABLE — {e}")

    log("=== End Report ===")
    return {
        "stats_24h": stats_24h,
        "stats_1h": stats_1h,
        "hourly_rate": hourly_rate,
        "open_reports": len(reports),
        "critical_reports": len(critical),
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        report = generate_report()
        print(json.dumps(report, indent=2))
    else:
        generate_report()
