# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Accept VERSION as a build argument
ARG IMAGE_VERSION=0.0.0

# Set environment variable
ENV VERSION=${IMAGE_VERSION}

# Optional: Persist the version in a file
RUN echo ${IMAGE_VERSION} > /app/version.txt

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Run main.py when the container launches
CMD ["python", "main.py"]
