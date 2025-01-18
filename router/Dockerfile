# Use the official Python image from the Docker Hub
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Accept VERSION as a build argument
ARG IMAGE_VERSION=0.0.0

# Set environment variable
ENV VERSION=${IMAGE_VERSION}

# Optional: Persist the version in a file
RUN echo ${IMAGE_VERSION} > /app/version.txt

# Copy the pdm configuration files to the container
COPY pyproject.toml pdm.lock /app/

# Install PDM
RUN pip install pdm

# Install project dependencies
RUN pdm install --prod

# Copy the rest of the application code to the container
COPY . /app

# Set the command to run the application
CMD ["pdm", "run", "prod"]
