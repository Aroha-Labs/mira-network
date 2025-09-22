# Build stage
FROM rust:latest AS builder

WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy source code
COPY src ./src

# Build for release
RUN cargo build --release

# Runtime stage
FROM debian:trixie-slim

WORKDIR /app

# Install OpenSSL and CA certificates
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from builder
COPY --from=builder /app/target/release/inference-logs-rs /app/inference-logs-rs

# Set the binary as executable
RUN chmod +x /app/inference-logs-rs

# Expose port (default 3000)
EXPOSE 3000

# Run the binary
CMD ["./inference-logs-rs"]