import os
import ipaddress
import sys


def validate_ip(ip: str | None) -> str:
    if not ip:
        print("ERROR: MACHINE_IP environment variable is not set")
        sys.exit(1)

    try:
        ipaddress.ip_address(ip)
        return ip
    except ValueError:
        print(f"ERROR: Invalid IP address: {ip}")
        sys.exit(1)


MACHINE_IP = validate_ip(os.getenv("MACHINE_IP"))
MACHINE_API_TOKEN = os.getenv("MACHINE_API_TOKEN")
