# ========================
# Stage 1: Build the app
# ========================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies in the builder stage
COPY package.json yarn.lock ./

# Install only production dependencies initially (improves layer cache)
RUN yarn install --frozen-lockfile

# Copy the rest of the app for building
COPY . .

# Build TypeScript into JavaScript
RUN yarn build

# ========================
# Stage 2: Runtime image
# ========================
FROM node:22-alpine AS runner

# Create app directory
WORKDIR /app

# Add a non-root user (good practice for security)
RUN addgroup --system appgroup && adduser --system appuser --ingroup appgroup

# Install libcap package (needed for setcap command)
RUN apk add --no-cache libcap

# Copy only production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy the built app from builder
COPY --from=builder /app/dist ./dist

# Optional: persist version info
ARG IMAGE_VERSION=0.0.0
ENV VERSION=${IMAGE_VERSION}
RUN echo ${IMAGE_VERSION} > /app/version.txt

# Copy only what you need for runtime
COPY package.json yarn.lock ./

# Set environment variables
ENV NODE_ENV=production

# Set capability to bind to privileged ports
RUN setcap cap_net_bind_service=+ep $(which node)

# Use non-root user to run the app
USER appuser

# Run the app
CMD ["yarn", "start:prod"]
