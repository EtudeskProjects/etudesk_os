#!/usr/bin/env python3
"""
Email Monitor — Etudesk Autonomous Agent
Monitors email delivery health via Resend API and DB stats.
The actual email sending is handled by the Node.js backend (email.service.ts).
This script provides delivery monitoring, bounce tracking, and alerting.
"""

import json
import os
import subprocess
import sys
from datetime import datetime

DB_CMD_PREFIX = [
    "psql", "-h", "localhost", "-U", "etudesk", "-d", "etudesk-db",
    "-t", "-A", "--no-psqlrc",
]
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "re_C5qUxYSV_6tYwiKE6JyaaZMciWYiX3DGK")
LOG_FILE = "/var/log/etudesk-agent/email-monitor.log"


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


def check_resend_api() -> dict:
    """Check Resend API health and get recent email stats."""
    try:
        import urllib.request
        url = "https://api.resend.com/emails"
        req = urllib.request.Request(url, method="GET")
        req.add_header("Authorization", f"Bearer {RESEND_API_KEY}")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return {"status": "ok", "data": data}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def check_resend_domains() -> dict:
    """Check Resend domain verification status."""
    try:
        import urllib.request
        url = "https://api.resend.com/domains"
        req = urllib.request.Request(url, method="GET")
        req.add_header("Authorization", f"Bearer {RESEND_API_KEY}")
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            return data
    except Exception as e:
        return {"error": str(e)}


def get_otp_stats(hours: int = 24) -> dict:
    """Get OTP email delivery stats from DB."""
    sql = f"""
    SELECT
        COUNT(*) AS total_otps,
        COUNT(*) FILTER (WHERE verified = true) AS verified,
        COUNT(*) FILTER (WHERE attempts >= 3) AS maxed_attempts,
        COUNT(*) FILTER (WHERE expires_at < NOW() AND verified = false) AS expired_unverified
    FROM otp_codes
    WHERE created_at > NOW() - INTERVAL '{hours} hours';
    """
    row = db_query(sql)
    if not row:
        return {"total_otps": 0, "verified": 0, "maxed_attempts": 0, "expired_unverified": 0}
    parts = row.split("|")
    return {
        "total_otps": int(parts[0] or 0),
        "verified": int(parts[1] or 0),
        "maxed_attempts": int(parts[2] or 0),
        "expired_unverified": int(parts[3] or 0),
    }


def get_notification_stats(hours: int = 24) -> dict:
    """Get notification delivery stats."""
    sql = f"""
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE read = true) AS read_count,
        COUNT(*) FILTER (WHERE type LIKE '%EMAIL%' OR channel = 'email') AS email_notifs
    FROM notifications
    WHERE created_at > NOW() - INTERVAL '{hours} hours';
    """
    row = db_query(sql)
    if not row:
        return {"total": 0, "read": 0, "email": 0}
    parts = row.split("|")
    return {
        "total": int(parts[0] or 0),
        "read": int(parts[1] or 0),
        "email": int(parts[2] or 0),
    }


def get_user_signups(hours: int = 24) -> dict:
    """Track new user registrations (OTP-related)."""
    sql = f"""
    SELECT
        COUNT(*) AS new_users,
        COUNT(*) FILTER (WHERE talent_id IS NOT NULL) AS with_talent
    FROM users
    WHERE created_at > NOW() - INTERVAL '{hours} hours' AND deleted_at IS NULL;
    """
    row = db_query(sql)
    if not row:
        return {"new_users": 0, "with_talent": 0}
    parts = row.split("|")
    return {
        "new_users": int(parts[0] or 0),
        "with_talent": int(parts[1] or 0),
    }


def test_smtp_connectivity() -> bool:
    """Quick SMTP connectivity test to Resend."""
    import socket
    try:
        sock = socket.create_connection(("smtp.resend.com", 465), timeout=5)
        sock.close()
        return True
    except Exception:
        return False


def generate_report():
    """Generate full email monitoring report."""
    log("=== Email Monitor Report ===")

    # SMTP connectivity
    smtp_ok = test_smtp_connectivity()
    log(f"SMTP connectivity (smtp.resend.com:465): {'OK' if smtp_ok else 'FAILED'}")

    # Resend API check
    api_status = check_resend_api()
    log(f"Resend API: {api_status['status']}")
    if api_status["status"] == "error":
        log(f"  Error: {api_status['error']}")

    # Domain verification
    domains = check_resend_domains()
    if "data" in domains:
        for d in domains["data"]:
            name = d.get("name", "?")
            status = d.get("status", "?")
            log(f"  Domain {name}: {status}")
            if status != "verified":
                log(f"  WARNING: Domain {name} not verified!")
    elif "error" in domains:
        log(f"  Domain check error: {domains['error']}")

    # OTP stats
    otp = get_otp_stats(24)
    log(f"OTP 24h: {otp['total_otps']} total, {otp['verified']} verified, {otp['maxed_attempts']} max-attempts, {otp['expired_unverified']} expired-unverified")
    if otp["total_otps"] > 0:
        verify_rate = otp["verified"] / otp["total_otps"] * 100
        log(f"  Verification rate: {verify_rate:.1f}%")
        if verify_rate < 50:
            log(f"  WARNING: Low OTP verification rate — possible delivery issues")

    # User signups
    signups = get_user_signups(24)
    log(f"New users 24h: {signups['new_users']} ({signups['with_talent']} with talent profile)")

    # Notifications
    notifs = get_notification_stats(24)
    log(f"Notifications 24h: {notifs['total']} total, {notifs['read']} read, {notifs['email']} email-type")

    log("=== End Report ===")
    return {
        "smtp_ok": smtp_ok,
        "resend_api": api_status["status"],
        "otp_stats": otp,
        "signups": signups,
        "notifications": notifs,
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        report = generate_report()
        print(json.dumps(report, indent=2))
    else:
        generate_report()
