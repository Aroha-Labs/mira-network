import httpx
import logging
import socket
import os
import random
import string
from typing import Optional, Dict, Any
from config import Env
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
    RetryError,
)

logger = logging.getLogger(__name__)


def generate_machine_id(length: int = 8) -> str:
    """
    Generate a tiny UUID-like alphanumeric string for machine identification

    Args:
        length: Length of the string to generate (default: 8)

    Returns:
        A random alphanumeric string
    """
    # Use only lowercase letters and numbers for better readability
    chars = string.ascii_lowercase + string.digits
    return "mira-" + "".join(random.choice(chars) for _ in range(length))


def get_local_ip() -> str:
    """Get local IP address of the machine"""
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        return local_ip
    except Exception as e:
        logger.error(f"Error getting local IP: {str(e)}")
        return "127.0.0.1"


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPError, httpx.RequestError)),
    before_sleep=before_sleep_log(logger, logging.INFO),
    reraise=True,
)
async def _perform_registration_request(
    client: httpx.AsyncClient,
    url: str,
    headers: Dict[str, str],
    json_data: Optional[Dict[str, Any]] = None,
) -> httpx.Response:
    """
    Helper function to perform HTTP requests with retry logic

    Args:
        client: httpx.AsyncClient instance for making HTTP requests
        url: Target URL for the request
        headers: HTTP request headers
        json_data: Optional JSON payload for POST requests

    Returns:
        httpx.Response object with the server response

    Raises:
        httpx.HTTPError: If the request fails after all retries
        RetryError: If maximum retry attempts are exhausted
    """
    if json_data is not None:
        response = await client.post(url, headers=headers, json=json_data)
    else:
        response = await client.get(url, headers=headers)

    response.raise_for_status()
    return response


async def register_machine(router_base_url: str) -> Optional[str]:
    """
    Register the machine with the router and obtain or create a machine API token
    Uses retry logic to handle transient network issues

    Returns the machine API token if successful, None otherwise
    """
    machine_ip = Env.MACHINE_IP or get_local_ip()
    # Use provided machine name or generate a tiny UUID-like name
    machine_name = Env.MACHINE_NAME or generate_machine_id()
    admin_token = Env.ADMIN_API_TOKEN

    if not admin_token:
        logger.error("ADMIN_API_TOKEN is not set")
        return None

    if not router_base_url:
        logger.error("ROUTER_BASE_URL is not set")
        return None

    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json",
    }

    # Step 1: Register machine if not already registered
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Check if machine with this IP is already registered
            check_machine_url = f"{router_base_url}/admin/machines/{machine_ip}"
            existing_machine = None

            try:
                # This call doesn't need retry as it's not critical - if it fails we'll just register anyway
                check_response = await client.get(check_machine_url, headers=headers)
                if check_response.status_code == 200:
                    # Machine exists, get its name for token description
                    existing_machine = check_response.json()
                    machine_name = existing_machine.get("name", machine_name)
                    logger.info(
                        f"Found existing machine: {machine_name} at {machine_ip}"
                    )
            except httpx.HTTPStatusError:
                # Machine not found, will register a new one
                logger.info(
                    f"No existing machine found at {machine_ip}, will register new"
                )
            except Exception as e:
                # Other errors, just log and continue with registration
                logger.warning(f"Error checking for existing machine: {str(e)}")

            # Registration with retry
            register_url = f"{router_base_url}/admin/machines/register"
            register_data = {
                "network_ip": machine_ip,
                "name": machine_name,
                "description": f"Auto-registered machine: {machine_name}",
                "disabled": False,
            }

            logger.info(f"Registering machine '{machine_name}' at {machine_ip}")
            try:
                response = await _perform_registration_request(
                    client, register_url, headers, register_data
                )
                logger.info(f"Machine registration status: {response.status_code}")
            except RetryError:
                logger.error("Failed to register machine after multiple attempts")
                return None

            # Step 2: List existing tokens with retry
            tokens_url = f"{router_base_url}/admin/machines/{machine_ip}/auth-tokens"
            try:
                tokens_response = await _perform_registration_request(
                    client, tokens_url, headers
                )
                tokens = tokens_response.json()
            except RetryError:
                logger.error("Failed to list tokens after multiple attempts")
                return None

            # If tokens exist, use the first one
            if tokens and len(tokens) > 0:
                logger.info("Found existing machine token")
                return tokens[0]["api_token"]

            # Step 3: Create token if none exists (with retry)
            create_token_url = (
                f"{router_base_url}/admin/machines/{machine_ip}/auth-tokens"
            )
            token_data = {"description": f"Auto-generated token for {machine_name}"}

            logger.info("Creating new machine token")
            try:
                token_response = await _perform_registration_request(
                    client, create_token_url, headers, token_data
                )
                new_token = token_response.json()
                logger.info("New machine token created successfully")
            except RetryError:
                logger.error("Failed to create token after multiple attempts")
                return None

            # Set the environment variable and update Env class
            os.environ["MACHINE_API_TOKEN"] = new_token["api_token"]
            # Also save the generated machine name
            if not Env.MACHINE_NAME:
                os.environ["MACHINE_NAME"] = machine_name
                Env.MACHINE_NAME = machine_name

            return new_token["api_token"]

    except Exception as e:
        logger.error(f"Unexpected error during machine registration: {str(e)}")

    return None
