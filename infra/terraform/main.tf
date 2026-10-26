# Terraform Configuration for Amrutam Telemedicine Production Cloud Infrastructure (AWS)

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "ap-south-1" # Mumbai (Primary Region)
}

variable "environment" {
  default = "production"
}

# 1. VPC & High-Availability Subnets
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "amrutam-telemedicine-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = false # Multi-AZ NAT for 99.95% SLA
  enable_dns_hostnames = true
}

# 2. PostgreSQL RDS Multi-AZ Cluster (Target: 100k daily consultations)
resource "aws_db_instance" "postgres_primary" {
  identifier           = "amrutam-telemedicine-postgres"
  engine               = "postgres"
  engine_version       = "16.2"
  instance_class       = "db.r6g.xlarge" # Memory-optimized instance
  allocated_storage    = 250
  max_allocated_storage= 2000 # Auto-scaling storage
  storage_type         = "io2"
  iops                 = 5000
  multi_az             = true # 99.95% HA SLA
  db_name              = "amrutam_telemedicine"
  username             = "amrutam_admin"
  password             = "super_secure_vault_managed_password" # Stored in AWS Secrets Manager in real deploy
  publicly_accessible  = false
  skip_final_snapshot  = false
  final_snapshot_identifier = "amrutam-final-snapshot"
  backup_retention_period = 35 # Point-In-Time Recovery
  backup_window        = "20:30-21:30"
  storage_encrypted    = true

  vpc_security_group_ids = [aws_security_group.db_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.rds_subnet_group.name
}

resource "aws_db_subnet_group" "rds_subnet_group" {
  name       = "amrutam-rds-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

# 3. Redis Cluster (ElastiCache) for Distributed Locks & L1 Caching
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "amrutam-redis-cluster"
  replication_group_description = "Redis cluster for distributed locking and doctor search cache"
  engine                        = "redis"
  engine_version                = "7.0"
  node_type                     = "cache.r6g.large"
  num_cache_clusters            = 3
  parameter_group_name          = "default.redis7"
  automatic_failover_enabled    = true
  multi_az_enabled              = true
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  subnet_group_name             = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids            = [aws_security_group.redis_sg.id]
}

resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "amrutam-redis-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

# 4. ECS Fargate Cluster & Service (Auto-scaling 5 - 50 tasks)
resource "aws_ecs_cluster" "app_cluster" {
  name = "amrutam-telemedicine-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# 5. Security Groups
resource "aws_security_group" "alb_sg" {
  name        = "amrutam-alb-sg"
  description = "Allow inbound HTTPS"
  vpc_id      = module.vpc.vpc_id

  ingress {
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
}

resource "aws_security_group" "db_sg" {
  name        = "amrutam-db-sg"
  description = "Allow PostgreSQL traffic only from ECS tasks"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_sg.id]
  }
}

resource "aws_security_group" "redis_sg" {
  name        = "amrutam-redis-sg"
  description = "Allow Redis traffic only from ECS tasks"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_sg.id]
  }
}

resource "aws_security_group" "ecs_sg" {
  name        = "amrutam-ecs-tasks-sg"
  description = "ECS Task security group"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
