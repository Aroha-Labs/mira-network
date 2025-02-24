.PHONY: build run test clean docker-build docker-run

# Go parameters
BINARY_NAME=service-app
MAIN_FILE=main.go
GO=go

# Docker parameters
DOCKER_IMAGE=mira-network/service-go
DOCKER_TAG=latest

# Build the application
build:
	$(GO) build -o $(BINARY_NAME) $(MAIN_FILE)

# Run the application
run:
	$(GO) run $(MAIN_FILE)

# Run the application with hot reload using air
dev:
	air

# Run tests
test:
	$(GO) test -v ./...

# Clean build artifacts
clean:
	$(GO) clean
	rm -f $(BINARY_NAME)

# Build the Docker image
docker-build:
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

# Run the Docker container
docker-run:
	docker run -p 8000:8000 --env-file .env $(DOCKER_IMAGE):$(DOCKER_TAG)

# Download dependencies
deps:
	$(GO) mod download

# Update dependencies
update-deps:
	$(GO) get -u ./...
	$(GO) mod tidy

# Install required tools
install-tools:
	$(GO) install github.com/cosmtrek/air@latest

# Help message
help:
	@echo "Available commands:"
	@echo "  make build         - Build the application"
	@echo "  make run           - Run the application"
	@echo "  make dev           - Run with hot reload (requires air)"
	@echo "  make test          - Run tests"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make docker-build  - Build the Docker image"
	@echo "  make docker-run    - Run the Docker container"
	@echo "  make deps          - Download dependencies"
	@echo "  make update-deps   - Update dependencies"
	@echo "  make install-tools - Install required development tools"

# Default target
default: build 
