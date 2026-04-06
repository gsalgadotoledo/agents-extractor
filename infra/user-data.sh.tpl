#!/bin/bash
set -euo pipefail

# Log everything
exec > >(tee /var/log/agents-extractor-setup.log) 2>&1
echo "=== Agents Extractor EC2 Setup ==="

# Install Docker
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker
usermod -aG docker ec2-user

# Install Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Clone repo
cd /home/ec2-user
git clone https://github.com/gsalgadotoledo/agents-extractor.git
cd agents-extractor

# Create .env
cat > .env <<'ENVEOF'
ANTHROPIC_API_KEY=${anthropic_api_key}
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USE_TLS=false
EMAIL_FROM_NAME=Processing Team
EMAIL_FROM_ADDRESS=processing@demo.agents-extractor.com
ENVEOF

# Login to ECR and pull image (if available), otherwise build locally
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${ecr_repo_url} 2>/dev/null && \
  docker pull ${ecr_repo_url}:latest 2>/dev/null && \
  docker tag ${ecr_repo_url}:latest agents-extractor:latest || \
  docker compose build

# Start with port 80 mapping
cat > docker-compose.override.yml <<'DCEOF'
services:
  api:
    ports:
      - "80:8000"
DCEOF

docker compose --profile dev up -d

# Set ownership
chown -R ec2-user:ec2-user /home/ec2-user/agents-extractor

echo "=== Setup complete ==="
echo "App available at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
