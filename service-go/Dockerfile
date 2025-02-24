FROM golang:1.20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache ca-certificates git

# Copy go.mod and go.sum first to leverage Docker cache
COPY go.mod ./
COPY go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o service-app .

# Use a minimal alpine image for the final stage
FROM alpine:3.18

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Copy the binary from the builder stage
COPY --from=builder /app/service-app .

# Set environment variables
ENV PORT=8000
ENV GIN_MODE=release

# Expose the application port
EXPOSE 8000

# Run the application
CMD ["./service-app"] 
