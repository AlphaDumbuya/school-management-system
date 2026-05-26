# Multi-stage build for React frontend
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package-lock.json ./frontend/

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend ./frontend

# Build React application
RUN npm run build -w frontend

# Stage 2: Runtime - Nginx
FROM nginx:alpine

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001

USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
