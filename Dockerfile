# Build stage for frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci --only=production

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Build stage for backend
FROM golang:1.23-alpine AS backend-builder

WORKDIR /app/backend

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Copy go mod files
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source
COPY backend/ ./

# Build the Go binary
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o noet .

# Final runtime image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 noet && \
    adduser -D -s /bin/sh -u 1000 -G noet noet

# Create data directory with proper permissions
RUN mkdir -p /data && \
    chown -R noet:noet /data

# Copy the built binary
COPY --from=backend-builder /app/backend/noet /usr/local/bin/noet

# Copy built frontend assets (these are embedded in the binary via static files)
# The Go binary serves static files from backend/static, which should contain the built frontend

# Set working directory
WORKDIR /data

# Switch to non-root user
USER noet

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/api/settings || exit 1

# Set default database path to persistent volume
ENV NOET_DB_PATH=/data/noet.db

# Run the application
CMD ["/usr/local/bin/noet"]