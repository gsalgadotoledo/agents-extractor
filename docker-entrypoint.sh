#!/bin/bash
set -e

# Serve static frontend if nginx is not available
# The API serves the frontend from /app/static/frontend

echo "Starting Agents Extractor API..."
echo "Frontend: http://localhost:8000"
echo "API docs: http://localhost:8000/docs"

exec uv run uvicorn submission_platform.api.app:app \
  --host 0.0.0.0 \
  --port 8000 \
  --log-level info
