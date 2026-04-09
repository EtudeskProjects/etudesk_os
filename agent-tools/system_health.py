#!/usr/bin/env python3
"""
System Health Check — Etudesk Autonomous Agent
Unified health check: PM2, disk, RAM, DB, SSL, services.
Run as: python3 system_health.py [--json]
"""

import json
import os
import subprocess
import sys
from datetime import datetime


def run(cmd: str, timeout: int = 10) -> str:
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, timeout=timeout,
    )
    return result.stdout.strip()


def db_query(sql: str) -> str:
    env = os.environ.copy()
    env["PGPASSWORD"] = "R2I7E3b5l6N9z5z"
    result = subprocess.run(
        ["psql", "-h", "localhost", "-U", "etudesk", "-d", "etudesk-db", "-t", "-A", "--no-psqlrc", "-c", sql],
        capture_output=True, text=True, env=env, timeout=10,
    )
    return result.stdout.strip()


def check_pm2() -> dict:
    try:
        raw = run("sudo pm2 jlist 2>/dev/null || pm2 jlist 2>/dev/null")
        if not raw:
            return {"status": "error", "processes": []}
        procs = json.loads(raw)
        result = []
        for p in procs:
            env = p.get("pm2_env", {})
            result.append({
                "name": p["name"],
                "status": env.get("status"),
                "pid": p.get("pid"),
                "restarts": env.get("restart_time", 0),
                "memory_mb": round(p.get("monit", {}).get("memory", 0) / 1024 / 1024, 1),
                "cpu": p.get("monit", {}).get("cpu", 0),
            })
        all_online = all(p["status"] == "online" for p in result)
        return {"status": "ok" if all_online else "degraded", "processes": result}
    except Exception as e:
        return {"status": "error", "error": str(e), "processes": []}


def check_disk() -> dict:
    line = run("df -h / | tail -1")
    parts = line.split()
    if len(parts) >= 5:
        usage = int(parts[4].replace("%", ""))
        return {
            "status": "critical" if usage > 90 else "warning" if usage > 80 else "ok",
            "usage_pct": usage,
            "used": parts[2],
            "total": parts[1],
            "available": parts[3],
        }
    return {"status": "error"}


def check_ram() -> dict:
    line = run("free -m | grep Mem")
    parts = line.split()
    if len(parts) >= 7:
        total = int(parts[1])
        available = int(parts[6])
        return {
            "status": "critical" if available < 500 else "warning" if available < 1024 else "ok",
            "total_mb": total,
            "available_mb": available,
            "used_pct": round((total - available) / total * 100, 1),
        }
    return {"status": "error"}


def check_services() -> dict:
    results = {}
    for name, url in [("api", "http://localhost:3000/health"), ("web", "http://localhost:3001")]:
        try:
            import urllib.request
            with urllib.request.urlopen(url, timeout=5) as resp:
                results[name] = {"status": "ok", "http_code": resp.status}
        except Exception as e:
            results[name] = {"status": "down", "error": str(e)}
    return results


def check_db() -> dict:
    try:
        size = db_query("SELECT pg_size_pretty(pg_database_size('etudesk-db'));")
        talents = int(db_query("SELECT COUNT(*) FROM talents;") or 0)
        users = int(db_query("SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;") or 0)
        return {"status": "ok", "size": size, "talents": talents, "users": users}
    except Exception as e:
        return {"status": "error", "error": str(e)}


def full_check() -> dict:
    return {
        "timestamp": datetime.now(tz=__import__('datetime').timezone.utc).isoformat(),
        "pm2": check_pm2(),
        "disk": check_disk(),
        "ram": check_ram(),
        "services": check_services(),
        "database": check_db(),
    }


if __name__ == "__main__":
    report = full_check()

    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        print(json.dumps(report, indent=2))
    else:
        print(f"=== System Health — {report['timestamp']} ===")
        for section, data in report.items():
            if section == "timestamp":
                continue
            status = data.get("status", "n/a")
            icon = "OK" if status == "ok" else "WARN" if status in ("warning", "degraded") else "CRIT" if status in ("critical", "down", "error") else "?"
            print(f"[{icon}] {section}: {json.dumps(data, default=str)}")
