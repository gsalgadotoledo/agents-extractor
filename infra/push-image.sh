#!/bin/bash
# Build and push Docker image to ECR
# Usage: ./push-image.sh [aws-region]
set -euo pipefail

REGION="${1:-us-east-1}"
REPO_URL=$(terraform output -raw ecr_repo_url)

echo "=== Logging in to ECR ==="
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REPO_URL"

echo "=== Building image ==="
cd ..
docker build -t agents-extractor .

echo "=== Pushing to ECR ==="
docker tag agents-extractor:latest "$REPO_URL:latest"
docker push "$REPO_URL:latest"

echo "=== Forcing ECS redeployment ==="
aws ecs update-service \
  --cluster agents-extractor \
  --service agents-extractor \
  --force-new-deployment \
  --region "$REGION" \
  --no-cli-pager

echo "=== Done! App will be live in ~2 minutes ==="
echo "URL: $(terraform output -raw app_url)"
