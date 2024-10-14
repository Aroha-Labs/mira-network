# Makefile to run go commands

# Go parameters
GOCMD=go

NAME=mira-client
VERSION=v0.0.0

# Phony
.PHONY: run dev test test-coverage

# Build the project for mac-m1, mac-intel, linux and windows
build:
	GOOS=darwin GOARCH=arm64 $(GOCMD) build -o bin/$(NAME)-mac-m1-$(VERSION)
	GOOS=darwin GOARCH=amd64 $(GOCMD) build -o bin/$(NAME)-mac-intel-$(VERSION)
	GOOS=linux GOARCH=amd64 $(GOCMD) build -o bin/$(NAME)-linux-$(VERSION)
	GOOS=windows GOARCH=amd64 $(GOCMD) build -o bin/$(NAME)-windows-$(VERSION).exe

# Run the project
run:
	$(GOCMD) run .

# Run the project on file change
dev:
	watchman-make -p '**/*.go' -t run

# Run tests
test:
	$(GOCMD) test -v ./...

# Run tests with coverage
test-coverage:
	$(GOCMD) test -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out
