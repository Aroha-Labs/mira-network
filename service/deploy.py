import requests
import argparse
from datetime import datetime
import os

machines = [
    # {
    #     "name": "fe8a981aed",
    #     "ip": "172.25.186.185",
    # },
    {
        "name": "5f7c1c1b2d",
        "ip": "172.25.143.133",
    },
    {
        "name": "d453d2f641",
        "ip": "172.25.241.187",
    },
    {
        "name": "766aabb88f",
        "ip": "172.25.248.148",
    },
]


def stop_and_remove_container(container_name, docker_api_url):
    """Stop and remove a Docker container."""
    try:
        # Stop the container
        print(f"Stopping container: {container_name}")
        response = requests.post(f"{docker_api_url}/containers/{container_name}/stop")
        if response.status_code == 404:
            print(f"Container {container_name} not found.")
        elif response.status_code == 204:
            print(f"Container {container_name} stopped.")

            # Remove the container
            response = requests.delete(f"{docker_api_url}/containers/{container_name}")
            if response.status_code == 204:
                print(f"Container {container_name} removed.")
            else:
                print(f"Failed to remove container {container_name}: {response.text}")
        else:
            print(f"Failed to stop container {container_name}: {response.text}")
    except Exception as e:
        print(f"Error handling container: {e}")


def delete_image(image_name, docker_api_url):
    """Delete a Docker image."""
    try:
        print(f"Deleting image: {image_name}")
        response = requests.delete(f"{docker_api_url}/images/{image_name}?force=true")
        if response.status_code == 404:
            print(f"Image {image_name} not found.")
        elif response.status_code == 200:
            print(f"Image {image_name} deleted.")
        else:
            print(f"Failed to delete image {image_name}: {response.text}")
    except Exception as e:
        print(f"Error deleting image: {e}")


def pull_image(image_name, docker_api_url, build_args=None):
    """Pull a Docker image."""
    try:
        print(f"Pulling image: {image_name}")
        print(f"Docker API URL: {docker_api_url}")
        params = {
            "fromImage": image_name,
        }
        if build_args:
            params["buildargs"] = build_args

        response = requests.post(
            f"{docker_api_url}/images/create", params=params, stream=True
        )
        if response.status_code == 200:
            # Wait for the pull to complete by reading the stream
            for line in response.iter_lines():
                print(".", end="", flush=True)
            print("\nImage {image_name} pulled successfully.")
            return True
        else:
            print(f"Failed to pull image {image_name}: {response.text}")
            return False
    except Exception as e:
        print(f"Error pulling image: {e}")
        return False


def start_container(
    container_name,
    image_name,
    version,
    docker_api_url,
    machine_id,
    environment=None,
):
    """Start a Docker container with version labels."""
    try:
        print(f"Creating and starting container: {container_name}")

        # First ensure image is pulled
        if not pull_image(image_name, docker_api_url=docker_api_url):
            print("Failed to pull image. Aborting container creation.")
            return

        # Initialize environment list if None
        if environment is None:
            environment = []

        # Read environment variables from .env file if it exists
        env_file = "/Users/sarim/projects/work/mira-network/service/.env"  # Adjust path as needed
        if os.path.exists(env_file):
            print(f"Loading environment variables from {env_file}")
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        environment.append(line)

        environment.append(f"MC_MACHINE_ID={machine_id}")
        # Ensure VERSION is included in environment variables
        version_env = f"VERSION={version.lstrip('v')}"
        if version_env not in environment:
            environment.append(version_env)

        print(environment)

        container_config = {
            "Image": image_name,
            "name": container_name,
            "HostConfig": {
                "RestartPolicy": {"Name": "always"},
                "NetworkMode": "mira-client-network",
                "PortBindings": {"8000/tcp": [{"HostPort": "34523"}]},
            },
            "Labels": {
                "com.arohalabs.service": container_name,
                "com.arohalabs.version": version,
                "com.arohalabs.deployment.date": datetime.now().isoformat(),
                "service-runner": "mira-client",
                "service-name": container_name,
            },
            "ExposedPorts": {"8000/tcp": {}},
            "Env": environment,
        }

        # Create the container
        response = requests.post(
            f"{DOCKER_API_URL}/containers/create?name={container_name}",
            json=container_config,
        )

        if response.status_code == 201:
            # Start the container
            container_id = response.json()["Id"]
            start_response = requests.post(
                f"{DOCKER_API_URL}/containers/{container_id}/start"
            )
            if start_response.status_code == 204:
                print(f"Container {container_name} started successfully.")
            else:
                print(
                    f"Failed to start container {container_name}: {start_response.text}"
                )
        else:
            print(f"Failed to create container {container_name}: {response.text}")
    except Exception as e:
        print(f"Error starting container: {e}")


def delete_all_containers(docker_api_url):
    """Stop and remove all Docker containers."""
    try:
        print("Listing all containers...")
        response = requests.get(f"{docker_api_url}/containers/json?all=true")
        if response.status_code == 200:
            containers = response.json()
            for container in containers:
                container_name = container["Names"][0].lstrip("/")
                stop_and_remove_container(container_name, docker_api_url)
        else:
            print(f"Failed to list containers: {response.text}")
    except Exception as e:
        print(f"Error listing containers: {e}")


def delete_all_images(docker_api_url):
    """Delete all Docker images."""
    try:
        print("Listing all images...")
        response = requests.get(f"{docker_api_url}/images/json")
        if response.status_code == 200:
            images = response.json()
            for image in images:
                for tag in image.get("RepoTags", []):
                    delete_image(tag, docker_api_url)
        else:
            print(f"Failed to list images: {response.text}")
    except Exception as e:
        print(f"Error listing images: {e}")


def delete_image_all_tags(base_image_name, docker_api_url):
    """Delete a Docker image with all its tags."""
    try:
        print(f"Listing images for: {base_image_name}")
        response = requests.get(f"{docker_api_url}/images/json")
        if response.status_code == 200:
            images = response.json()
            for image in images:
                for tag in image.get("RepoTags", []):
                    if base_image_name in tag:
                        delete_image(tag, docker_api_url)
        else:
            print(f"Failed to list images: {response.text}")
    except Exception as e:
        print(f"Error listing images: {e}")


def stream_logs(container_name, docker_api_url):
    """Stream logs from a container in real-time."""
    try:
        print(f"Streaming logs for container: {container_name}")
        response = requests.get(
            f"{docker_api_url}/containers/{container_name}/logs",
            params={
                "follow": True,
                "stdout": True,
                "stderr": True,
                "timestamps": True,
                "tail": "100",
            },
            stream=True,
        )

        if response.status_code == 200:
            for line in response.iter_lines():
                # Docker log format includes 8 bytes of header we need to skip
                if line:
                    # Skip header bytes and decode
                    log_line = line[8:].decode("utf-8")
                    print(log_line)
        else:
            print(f"Failed to get logs: {response.text}")
    except Exception as e:
        print(f"Error streaming logs: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy Docker container with version tag"
    )
    parser.add_argument("--version", default="latest", help="Version tag for the image")
    parser.add_argument(
        "--env", nargs="*", help="Environment variables in KEY=VALUE format"
    )
    parser.add_argument(
        "--env-file", help="Path to environment file", default="../.env"
    )
    args = parser.parse_args()

    # Convert environment variables list to proper format
    environment = args.env if args.env else []

    VERSION = args.version
    IMAGE_NAME = f"ghcr.io/aroha-labs/mira-client-service:{VERSION}"
    BASE_IMAGE_NAME = "ghcr.io/aroha-labs/mira-client-service"
    CONTAINER_NAME = "mira-client-service"

    for machine in machines:
        DOCKER_API_URL = f"http://{machine['ip']}:2375"
        machine_id = machine["name"]

        # Step 1: Stop and remove only the mira-client-service container
        stop_and_remove_container(CONTAINER_NAME, DOCKER_API_URL)
        delete_image_all_tags(BASE_IMAGE_NAME, DOCKER_API_URL)

        # Step 2: Start the container (includes pulling the image)
        start_container(
            CONTAINER_NAME,
            IMAGE_NAME,
            VERSION,
            docker_api_url=DOCKER_API_URL,
            machine_id=machine_id,
            environment=environment,
        )

    # Step 3: Stream logs
    # stream_logs(CONTAINER_NAME, DOCKER_API_URL)
