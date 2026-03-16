import ssl
import socket
from datetime import datetime
from app.database import get_db
from urllib.parse import urlparse


def check_ssl_sync(hostname: str) -> dict | None:
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with socket.create_connection((hostname, 443), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert(binary_form=False)
                if not cert:
                    # Try with verification
                    ctx2 = ssl.create_default_context()
                    with socket.create_connection((hostname, 443), timeout=10) as sock2:
                        with ctx2.wrap_socket(sock2, server_hostname=hostname) as ssock2:
                            cert = ssock2.getpeercert()

                if not cert:
                    return None

                subject = dict(x[0] for x in cert.get("subject", ()))
                issuer = dict(x[0] for x in cert.get("issuer", ()))
                not_after = cert.get("notAfter", "")
                not_before = cert.get("notBefore", "")

                valid_to = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z") if not_after else None
                days_remaining = (valid_to - datetime.utcnow()).days if valid_to else 0

                return {
                    "issuer": issuer.get("organizationName", issuer.get("commonName", str(issuer))),
                    "subject": subject.get("commonName", str(subject)),
                    "valid_from": not_before,
                    "valid_to": not_after,
                    "days_remaining": days_remaining,
                }
    except Exception:
        return None


async def check_monitor_ssl(monitor_id: int) -> dict | None:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT url FROM monitors WHERE id = ?", (monitor_id,))
        monitor = await cursor.fetchone()
        if not monitor:
            return None

        hostname = urlparse(monitor["url"]).hostname
        if not hostname:
            return None

        info = check_ssl_sync(hostname)
        if not info:
            return None

        await db.execute(
            "INSERT INTO ssl_certificates (monitor_id, issuer, subject, valid_from, valid_to, days_remaining) VALUES (?, ?, ?, ?, ?, ?)",
            (monitor_id, info["issuer"], info["subject"], info["valid_from"], info["valid_to"], info["days_remaining"]),
        )
        await db.commit()
        return info
    finally:
        await db.close()
