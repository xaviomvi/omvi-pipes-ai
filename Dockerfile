# Multi-stage Dockerfile for separate frontend and backend directories

# Stage 1: Build frontend
FROM node:20 AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm config set legacy-peer-deps true && npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:20 AS backend-builder
WORKDIR /build/backend
RUN apt-get update && apt-get install -y iputils-ping telnet traceroute dnsutils net-tools curl wget
COPY services/nodejs/apps/package*.json ./
COPY services/nodejs/apps/tsconfig.json ./
COPY services/nodejs/apps/src ./src
# Set up architecture detection and conditional handling
RUN set -e; \
    # Detect architecture
    ARCH=$(uname -m); \
    echo "Building for architecture: $ARCH"; \
    # Platform-specific handling
    if [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then \
        echo "Detected ARM architecture (M1/Apple Silicon)"; \
        # ARM-specific handling: Skip problematic binary or use alternative
        npm install --prefix ./ --ignore-scripts && \
        npm uninstall jpeg-recompress-bin --prefix ./ || true && \
        npm install imagemin-mozjpeg --prefix ./ --save; \
    else \
        echo "Detected x86 architecture"; \
        # Standard install for x86 platforms
        apt-get install -y libc6-dev-i386; npm install --prefix ./; \
    fi
RUN npm run build

# Stage 3: Production runtime
FROM node:20
WORKDIR /app

# Copy backend dependencies and build
COPY --from=backend-builder /build/backend/dist ./dist
COPY --from=backend-builder /build/backend/node_modules ./node_modules


# If you have any templates or views needed for backend
COPY --from=backend-builder /build/backend/src/modules/mail/views ./src/modules/mail/views

# Copy frontend build to a directory the backend can serve
COPY --from=frontend-builder /build/frontend/dist ./dist/public

RUN apt-get update && apt-get install -y \
    iputils-ping telnet traceroute dnsutils net-tools curl wget \
    openssh-server && npm install -g pm2


# Expose application port
EXPOSE 3000

# Start the combined server
CMD ["/bin/sh", "-c", "node /app/dist/index.js"]
