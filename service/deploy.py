import requests

DOCKER_API_URL = "http://localhost:2375"
SERVICE_NAME = "mira-client-service"
IMAGE_NAME = "ghcr.io/aroha-labs/mira-client-service:main"


def stop_and_remove_service(service_name):
    """Stop and remove a Docker service."""
    try:
        # Stop the service
        print(f"Stopping service: {service_name}")
        response = requests.delete(f"{DOCKER_API_URL}/services/{service_name}")
        if response.status_code == 404:
            print(f"Service {service_name} not found.")
        elif response.status_code == 200:
            print(f"Service {service_name} stopped and removed.")
        else:
            print(f"Failed to stop service {service_name}: {response.text}")
    except Exception as e:
        print(f"Error stopping service: {e}")


def delete_image(image_name):
    """Delete a Docker image."""
    try:
        print(f"Deleting image: {image_name}")
        response = requests.delete(f"{DOCKER_API_URL}/images/{image_name}")
        if response.status_code == 404:
            print(f"Image {image_name} not found.")
        elif response.status_code == 200:
            print(f"Image {image_name} deleted.")
        else:
            print(f"Failed to delete image {image_name}: {response.text}")
    except Exception as e:
        print(f"Error deleting image: {e}")


def start_service(service_name, image_name):
    """Start a Docker service."""
    try:
        print(f"Starting service: {service_name}")
        service_config = {
            "Name": service_name,
            "TaskTemplate": {
                "ContainerSpec": {
                    "Image": image_name,
                },
            },
        }
        response = requests.post(
            f"{DOCKER_API_URL}/services/create", json=service_config
        )
        if response.status_code == 201:
            print(f"Service {service_name} started successfully.")
        else:
            print(f"Failed to start service {service_name}: {response.text}")
    except Exception as e:
        print(f"Error starting service: {e}")


if __name__ == "__main__":
    # Step 1: Stop and remove the service
    stop_and_remove_service(SERVICE_NAME)

    # Step 2: Delete the image
    delete_image(IMAGE_NAME)

    # Step 3: Start the service
    start_service(SERVICE_NAME, IMAGE_NAME)
