FROM python:3.13-slim AS backend

WORKDIR /app

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy project files
COPY pyproject.toml uv.lock ./
COPY src/ src/

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy test data for demo
COPY test-files/ test-files/
COPY scripts/ scripts/

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "submission_platform.api.app:app", "--host", "0.0.0.0", "--port", "8000"]

# --- Frontend build ---
FROM node:22-slim AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# --- Portal build ---
FROM node:22-slim AS portal-build

WORKDIR /app
COPY portal/package.json portal/package-lock.json ./
RUN npm ci
COPY portal/ .
RUN npm run build

# --- Production image ---
FROM python:3.13-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Python deps
COPY pyproject.toml uv.lock ./
COPY src/ src/
RUN uv sync --frozen --no-dev

# Static frontend builds
COPY --from=frontend-build /app/dist /app/static/frontend
COPY --from=portal-build /app/dist /app/static/portal

# Demo data
COPY test-files/ test-files/
COPY scripts/ scripts/

# Entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

CMD ["/app/docker-entrypoint.sh"]
