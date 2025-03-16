import os


class Env:
    MACHINE_IP = os.getenv("MACHINE_IP")
    MACHINE_API_TOKEN = os.getenv("MACHINE_API_TOKEN")
