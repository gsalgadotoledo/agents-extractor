#!/bin/bash
# Quick EC2 setup script for Agents Extractor demo
# Run on a fresh Amazon Linux 2023 / Ubuntu 22.04 instance
#
# Usage:
#   1. Launch an EC2 t3.small (or t3.micro for free tier)
#   2. SSH in and run: bash setup-ec2.sh
#   3. Set up .env file with your ANTHROPIC_API_KEY
#   4. Run the app

set -e

echo "=== Installing Docker ==="
if command -v apt-get &>/dev/null; then
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-plugin git
  sudo usermod -aG docker $USER
elif command -v yum &>/dev/null; then
  sudo yum update -y
  sudo yum install -y docker git
  sudo systemctl start docker
  sudo systemctl enable docker
  sudo usermod -aG docker $USER
  # Install docker compose plugin
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

echo "=== Cloning repo ==="
git clone https://github.com/gsalgadotoledo/agents-extractor.git ~/agents-extractor
cd ~/agents-extractor

echo "=== Creating .env ==="
cp .env.example .env
echo ""
echo "⚠️  Edit .env and add your ANTHROPIC_API_KEY:"
echo "    nano ~/agents-extractor/.env"
echo ""
echo "Then run:"
echo "    cd ~/agents-extractor && docker compose up -d"
echo ""
echo "The app will be available on port 8000."
echo "Make sure your EC2 security group allows inbound traffic on port 8000 (or 80 if you map it)."
