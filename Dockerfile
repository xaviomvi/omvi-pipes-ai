# Multi-stage Dockerfile for separate aibackend, frontend and backend directories

##### BUILD STAGE ########
# Stage 1: Build AI Backend
FROM python:3.10 AS python-builder

WORKDIR /build/aibackend

# Create a virtual environment in the /venv directory
RUN python -m venv /venv

# Activate the virtual environment and install build dependencies
ENV PATH="/venv/bin:$PATH"
# Install dependencies
COPY ./services/python/pyproject.toml ./
RUN pip3 install --no-cache-dir -e . && \
    pip3 install --no-cache-dir pyinstaller

# Copy application files
COPY services/python/app/ ./app/

# Set PYTHONPATH
ENV PYTHONPATH="/build:$PYTHONPATH"

# Build binaries
RUN pyinstaller --hidden-import=requests --hidden-import=urllib3 \
    --hidden-import=app.indexing_main --hidden-import=dateutil --hidden-import=dateutil.tz \
    --hidden-import=dateutil.zoneinfo --collect-all=requests --hidden-import=pydantic \
    --hidden-import=pydantic-core --hidden-import=pydantic.deprecated.decorator \
    --collect-submodules=dependency_injector --collect-all=dateutil app/indexing_main.py

RUN pyinstaller --hidden-import=requests --hidden-import=urllib3 \
    --hidden-import=app.connectors_main --hidden-import=dateutil --hidden-import=dateutil.tz \
    --hidden-import=dateutil.zoneinfo --collect-all=requests --hidden-import=pydantic \
    --hidden-import=pydantic-core --hidden-import=pydantic.deprecated.decorator \
    --collect-submodules=dependency_injector --collect-all=dateutil app/connectors_main.py

RUN pyinstaller --hidden-import=requests --hidden-import=urllib3 \
    --hidden-import=app.query_main --hidden-import=dateutil --hidden-import=dateutil.tz \
    --hidden-import=dateutil.zoneinfo --collect-all=requests --hidden-import=pydantic \
    --hidden-import=pydantic-core --hidden-import=pydantic.deprecated.decorator \
    --collect-submodules=dependency_injector --collect-all=dateutil app/query_main.py

# Stage 2: Build frontend
FROM node:20 AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm config set legacy-peer-deps true && npm install
COPY frontend/ ./
RUN npm run build

# Stage 3: Build backend
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


##### FINAL STAGE ########
FROM python:3.10

WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC

# Install Node.js and necessary runtime libraries
RUN apt-get update && apt-get install -y \
    curl gnupg iputils-ping telnet traceroute dnsutils net-tools wget \
    librocksdb-dev libgflags-dev libsnappy-dev zlib1g-dev \
    libbz2-dev liblz4-dev libzstd-dev libssl-dev ca-certificates libspatialindex-dev libpq5 && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy Python build artifacts
COPY --from=python-builder /build/aibackend/dist/indexing_main ./
COPY --from=python-builder /build/aibackend/dist/connectors_main ./
COPY --from=python-builder /build/aibackend/dist/query_main ./

# Set executable permissions for Python binaries
RUN chmod +x /app/indexing_main && \
    chmod +x /app/connectors_main && \
    chmod +x /app/query_main

# Copy backend dependencies and build
COPY --from=backend-builder /build/backend/dist ./dist
COPY --from=backend-builder /build/backend/node_modules ./node_modules

# If you have any templates or views needed for backend
COPY --from=backend-builder /build/backend/src/modules/mail/views ./src/modules/mail/views
COPY --from=backend-builder /build/backend/src/modules/storage/docs/swagger.yaml ./dist/modules/storage/docs/swagger.yaml

# Copy frontend build to a directory the backend can serve
COPY --from=frontend-builder /build/frontend/dist ./dist/public

# Expose necessary ports
EXPOSE 3000 8000 8080 8091

# Start all services
CMD sh -c "node /app/dist/index.js & /app/connectors_main & /app/indexing_main & /app/query_main & wait"
