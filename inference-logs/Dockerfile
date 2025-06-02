FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy app source
COPY . .

# Build TypeScript code
RUN npm run build:ts

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the service
CMD ["npm", "start"] 