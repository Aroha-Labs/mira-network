import os


class Env:
    # IP address of the current machine in the network
    # If not provided, will be automatically detected
    MACHINE_IP = os.getenv("MACHINE_IP")

    # Human-readable name for this machine instance
    # If not provided, will be automatically generated as a unique ID (e.g. mira-a7b3c9d2)
    MACHINE_NAME = os.getenv("MACHINE_NAME")

    # Admin API token used for machine registration and token management
    # Required for the service to register itself with the router
    ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN")

    # Machine-specific API token used for regular operations like liveness checks
    # If not provided at startup, will be obtained during registration
    MACHINE_API_TOKEN = os.getenv("MACHINE_API_TOKEN")
