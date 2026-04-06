# =============================================================================
# Agents Extractor — AWS Infrastructure (Terraform)
# =============================================================================
# Deploys: VPC, ECS Fargate, ALB, ECR, CloudWatch Logs
# 
# Usage:
#   cd infra/
#   terraform init
#   terraform plan
#   terraform apply
#
# First deploy:
#   1. terraform apply                    (creates ECR + infra)
#   2. ./push-image.sh                    (builds & pushes Docker image)
#   3. terraform apply                    (ECS pulls the image)
#
# Cost: ~$5-8/month (Fargate 0.25 vCPU / 512MB + ALB)
# =============================================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "agents-extractor"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "demo"
}

variable "anthropic_api_key" {
  description = "Anthropic API key for Claude"
  type        = string
  sensitive   = true
}

variable "cpu" {
  description = "Fargate task CPU (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Fargate task memory (MB)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Number of running tasks"
  type        = number
  default     = 1
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# =============================================================================
# VPC
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "agents-extractor-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "agents-extractor-igw" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "agents-extractor-public-${count.index + 1}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "agents-extractor-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# =============================================================================
# Security Groups
# =============================================================================

resource "aws_security_group" "alb" {
  name_prefix = "agents-extractor-alb-"
  description = "ALB - public HTTP/HTTPS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "ecs" {
  name_prefix = "agents-extractor-ecs-"
  description = "ECS tasks - only from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "From ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle { create_before_destroy = true }
}

# =============================================================================
# Application Load Balancer
# =============================================================================

resource "aws_lb" "main" {
  name               = "agents-extractor-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  tags = { Name = "agents-extractor-alb" }
}

resource "aws_lb_target_group" "app" {
  name        = "agents-extractor-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# =============================================================================
# ECR Repository
# =============================================================================

resource "aws_ecr_repository" "app" {
  name                 = "agents-extractor"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# =============================================================================
# CloudWatch Logs
# =============================================================================

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/agents-extractor"
  retention_in_days = 7
}

# =============================================================================
# ECS Cluster
# =============================================================================

resource "aws_ecs_cluster" "main" {
  name = "agents-extractor"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

# =============================================================================
# IAM — ECS Task Execution Role
# =============================================================================

resource "aws_iam_role" "ecs_execution" {
  name = "agents-extractor-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "agents-extractor-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# =============================================================================
# ECS Task Definition
# =============================================================================

resource "aws_ecs_task_definition" "app" {
  family                   = "agents-extractor"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "app"
    image = "${aws_ecr_repository.app.repository_url}:latest"

    portMappings = [{
      containerPort = 8000
      hostPort      = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "API_HOST", value = "0.0.0.0" },
      { name = "API_PORT", value = "8000" },
      { name = "LOG_LEVEL", value = "INFO" },
      { name = "ANTHROPIC_API_KEY", value = var.anthropic_api_key },
      { name = "EMAIL_FROM_NAME", value = "Processing Team" },
      { name = "EMAIL_FROM_ADDRESS", value = "processing@demo.agents-extractor.com" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    essential = true
  }])
}

# =============================================================================
# ECS Service
# =============================================================================

resource "aws_ecs_service" "app" {
  name            = "agents-extractor"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.http]

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "app_url" {
  description = "Application URL (ALB)"
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_repo_url" {
  description = "ECR repository URL (for docker push)"
  value       = aws_ecr_repository.app.repository_url
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "push_commands" {
  description = "Commands to build and push Docker image"
  value       = <<-EOT
    # Build and push:
    aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app.repository_url}
    docker build -t agents-extractor .
    docker tag agents-extractor:latest ${aws_ecr_repository.app.repository_url}:latest
    docker push ${aws_ecr_repository.app.repository_url}:latest
    
    # Force new deployment:
    aws ecs update-service --cluster agents-extractor --service agents-extractor --force-new-deployment --region ${var.aws_region}
  EOT
}
