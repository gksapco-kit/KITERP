---
name: AWS Deployment Plan
overview: Complete step-by-step plan to deploy the KITERP multi-vendor SaaS platform (FastAPI backend + 3 React frontends + PostgreSQL + MongoDB + Redis) to AWS using EC2 with Docker Compose, managed databases (RDS, DocumentDB/Atlas, ElastiCache), S3, Route 53, and SSL.
todos:
  - id: modify-compose
    content: Modify docker-compose.prod.yml to support managed AWS services (RDS, ElastiCache, Atlas) -- remove DB containers, update connection strings
    status: completed
  - id: nginx-ssl
    content: Update Nginx config (docker/nginx/conf.d/default.conf) to add HTTPS (443) listeners and HTTP-to-HTTPS redirect
    status: completed
  - id: systemd-service
    content: Create systemd service file for auto-start on EC2 reboot
    status: completed
  - id: env-template
    content: Update .env.example with AWS managed service endpoint placeholders
    status: completed
  - id: deploy-script
    content: Create a deploy.sh script to automate git pull, build, migrate, and restart
    status: completed
isProject: false
---

# AWS Deployment Plan for KITERP

## Current Architecture Summary

```mermaid
graph TB
  subgraph clients [Clients]
    Browser[Browser]
    MobileApp[Mobile App]
  end

  subgraph aws [AWS Cloud]
    subgraph vpc [VPC - ap-south-1]
      subgraph publicSubnet [Public Subnet]
        ALB[Application Load Balancer]
        EC2[EC2 Instance - Docker Host]
      end

      subgraph privateSubnet [Private Subnet]
        RDS[RDS PostgreSQL 15]
        DocDB[DocumentDB / MongoDB Atlas]
        Redis[ElastiCache Redis 7]
      end
    end

    R53[Route 53 DNS]
    ACM[ACM SSL Certificate]
    S3[S3 Bucket - Uploads]
    CF[CloudFront CDN - Optional]
  end

  Browser --> R53
  MobileApp --> R53
  R53 --> ALB
  ALB --> EC2
  EC2 --> RDS
  EC2 --> DocDB
  EC2 --> Redis
  EC2 --> S3
  ALB -.-> ACM
```



Your project runs **7 Docker containers** in production (via [docker-compose.prod.yml](docker-compose.prod.yml)):

- **backend** (FastAPI, port 8000)
- **frontend** (Admin panel, port 3000)
- **vendor-web** (Vendor dashboard, port 3001)
- **storefront-web** (Customer storefront, port 3002)
- **nginx** (Reverse proxy/gateway, ports 80/443)
- **postgres** (PostgreSQL 15)
- **mongo** (MongoDB 7)
- **redis** (Redis 7)

## AWS Services Required


| What | AWS Service | Why | Estimated Monthly Cost (ap-south-1) |
| ---- | ----------- | --- | ----------------------------------- |


- **Compute**: EC2 (t3.medium or t3.large) -- runs Docker containers -- ~$30-60/month
- **Primary DB**: RDS PostgreSQL 15 (db.t3.micro/small) -- managed, automated backups -- ~$15-30/month
- **Document DB**: MongoDB Atlas Free/M10 OR EC2-hosted MongoDB -- flexible schemas -- Free-$60/month
- **Cache**: ElastiCache Redis (cache.t3.micro) -- session/tenant caching -- ~$12/month
- **Storage**: S3 bucket -- product/service image uploads -- ~$1-5/month
- **DNS**: Route 53 -- domain management, subdomain routing -- ~$0.50/month
- **SSL**: ACM (Certificate Manager) -- free HTTPS certificates -- Free
- **Load Balancer**: ALB (Application Load Balancer) -- SSL termination, health checks -- ~$16/month (optional, can use Nginx+Certbot on EC2 instead)
- **CDN**: CloudFront (optional) -- serve static assets globally -- ~$1-5/month

**Estimated total: $75-180/month** (depending on choices made below)

---

## Budget-Friendly vs Production-Ready Options

**Option A: Budget-Friendly (Single EC2, ~$50-80/month)**

- 1x EC2 t3.medium (all containers including DBs run via Docker Compose)
- S3 for uploads
- Route 53 + Certbot for SSL
- Best for: MVP, early-stage, low traffic

**Option B: Production-Ready (~$120-200/month)**

- 1x EC2 t3.large (app containers only)
- RDS PostgreSQL (managed, automated backups)
- ElastiCache Redis (managed)
- MongoDB Atlas M10 or self-hosted on EC2
- ALB + ACM for SSL
- Best for: production traffic, reliability

The steps below cover **Option B** (production-ready) with notes where you can simplify for Option A.

---

## Step 1: AWS Account and IAM Setup

### 1.1 Create/Login to AWS Account

- Go to [https://aws.amazon.com](https://aws.amazon.com) and sign up or log in
- Set region to **ap-south-1 (Mumbai)** (closest to India, matching your config)

### 1.2 Create an IAM User for deployment

```bash
# In AWS Console > IAM > Users > Create User
Username: kiterp-deployer
Attach policies:
  - AmazonEC2FullAccess
  - AmazonRDSFullAccess
  - AmazonS3FullAccess
  - AmazonElastiCacheFullAccess
  - AmazonRoute53FullAccess
  - AmazonVPCFullAccess
  - ElasticLoadBalancingFullAccess
```

- Download the access key and secret key (used in `.env` for S3 access)

---

## Step 2: Networking -- VPC and Security Groups

### 2.1 Create VPC (or use default)

- VPC CIDR: `10.0.0.0/16`
- Public Subnet 1: `10.0.1.0/24` (az: ap-south-1a)
- Public Subnet 2: `10.0.2.0/24` (az: ap-south-1b) -- needed for ALB
- Private Subnet 1: `10.0.10.0/24` (for RDS/Redis)
- Private Subnet 2: `10.0.11.0/24` (for RDS/Redis -- multi-AZ)
- Internet Gateway attached
- Route table: public subnets -> IGW

### 2.2 Security Groups

**SG-EC2 (for the EC2 instance)**:

- Inbound: SSH (22) from your IP only
- Inbound: HTTP (80) from 0.0.0.0/0
- Inbound: HTTPS (443) from 0.0.0.0/0
- Outbound: All traffic

**SG-RDS (for PostgreSQL)**:

- Inbound: PostgreSQL (5432) from SG-EC2 only
- Outbound: All traffic

**SG-Redis (for ElastiCache)**:

- Inbound: Redis (6379) from SG-EC2 only
- Outbound: All traffic

**SG-MongoDB (if self-hosted on EC2)**:

- Inbound: MongoDB (27017) from SG-EC2 only

---

## Step 3: Create the EC2 Instance

### 3.1 Launch EC2

- **AMI**: Amazon Linux 2023 or Ubuntu 22.04 LTS
- **Instance type**: t3.medium (2 vCPU, 4GB RAM) or t3.large (2 vCPU, 8GB RAM)
- **Key pair**: Create new key pair (download `.pem` file, keep safe)
- **Network**: Place in Public Subnet 1
- **Security Group**: SG-EC2
- **Storage**: 30GB gp3 (root volume)
- **Elastic IP**: Allocate and associate one (so IP stays fixed on restart)

### 3.2 SSH into EC2 and Install Dependencies

```bash
# SSH into EC2
ssh -i "kiterp-key.pem" ec2-user@<ELASTIC-IP>

# Update system (Amazon Linux 2023)
sudo dnf update -y

# Install Docker
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose v2
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install Git
sudo dnf install git -y

# Verify
docker --version
docker compose version
git --version

# Log out and back in for docker group to take effect
exit
```

### 3.3 Clone the Project

```bash
ssh -i "kiterp-key.pem" ec2-user@<ELASTIC-IP>

# Clone your code (set up a git repo first if not already)
git clone <your-repo-url> /home/ec2-user/kiterp
cd /home/ec2-user/kiterp
```

---

## Step 4: Create the PostgreSQL Database (RDS)

### 4.1 Create RDS Instance

- **AWS Console > RDS > Create Database**
- Engine: PostgreSQL 15
- Template: Free tier (db.t3.micro) or Production (db.t3.small)
- DB Instance Identifier: `kiterp-postgres`
- Master username: `postgres`
- Master password: (set a strong password)
- VPC: Same VPC as EC2
- Subnet Group: private subnets
- Security Group: SG-RDS
- Public access: **No**
- Initial database name: `kiterp`
- Enable automated backups: Yes (7 days retention)
- Storage: 20GB gp3, enable autoscaling

### 4.2 Get Connection Endpoint

After creation, note the endpoint (e.g., `kiterp-postgres.xxxxx.ap-south-1.rds.amazonaws.com`)

### 4.3 Initialize the Database

SSH into EC2 and run:

```bash
# Install psql client
sudo dnf install postgresql15 -y

# Connect and run init script
psql -h kiterp-postgres.xxxxx.ap-south-1.rds.amazonaws.com \
     -U postgres -d kiterp -f /home/ec2-user/kiterp/docker/init-db.sql
```

**For Option A (budget)**: Skip RDS, keep PostgreSQL in Docker Compose. Just ensure you mount a persistent EBS volume for data.

---

## Step 5: Set Up Redis (ElastiCache)

### 5.1 Create ElastiCache Redis Cluster

- **AWS Console > ElastiCache > Create Cluster**
- Engine: Redis 7
- Node type: cache.t3.micro
- Number of replicas: 0 (single node for cost savings)
- Subnet group: private subnets
- Security Group: SG-Redis
- Encryption in-transit: Yes
- Auth token: (set a password)

### 5.2 Get Endpoint

Note the primary endpoint (e.g., `kiterp-redis.xxxxx.cache.amazonaws.com:6379`)

**For Option A (budget)**: Skip ElastiCache, keep Redis in Docker Compose.

---

## Step 6: Set Up MongoDB

### Option 1: MongoDB Atlas (Recommended)

- Go to [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
- Create a free M0 cluster (or M10 for production)
- Whitelist the EC2 Elastic IP
- Get connection string: `mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/kiterp`

### Option 2: Self-hosted on EC2 (via Docker Compose)

- Keep the mongo service in `docker-compose.prod.yml`
- Mount data to an EBS volume

---

## Step 7: Create S3 Bucket for File Uploads

```bash
# AWS Console > S3 > Create Bucket
Bucket name: kiterp-uploads
Region: ap-south-1
Block public access: Configure based on needs
  - If using pre-signed URLs: Block all public access
  - If direct access: Allow public read on specific prefixes

# Create folder structure
uploads/products/
uploads/services/

# CORS configuration (for browser uploads if needed)
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://kiterp.com", "https://*.kiterp.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Your backend already has S3 support via `boto3`/`aioboto3` in [backend/app/config.py](backend/app/config.py) with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` settings.

---

## Step 8: Configure Environment and Docker Compose for Production

### 8.1 Create the Production `.env` File on EC2

```bash
cd /home/ec2-user/kiterp
cp .env.example .env
nano .env
```

Update `.env` with real values:

```env
# PostgreSQL (RDS)
POSTGRES_DB=kiterp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<your-rds-password>

# Redis (ElastiCache)
REDIS_PASSWORD=<your-elasticache-auth-token>

# JWT
JWT_SECRET_KEY=<generate-with: openssl rand -hex 32>
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Domain
BASE_DOMAIN=kiterp.com

# API URLs
VITE_ADMIN_API_URL=/api/v1
VITE_VENDOR_API_URL=/api/v1
VITE_STOREFRONT_API_URL=/api/v1

# AWS S3
AWS_ACCESS_KEY_ID=<your-iam-access-key>
AWS_SECRET_ACCESS_KEY=<your-iam-secret-key>
AWS_REGION=ap-south-1
AWS_S3_BUCKET=kiterp-uploads
```

### 8.2 Modify `docker-compose.prod.yml` for Managed Services

When using RDS + ElastiCache + Atlas, you need to:

1. **Remove** the `postgres`, `mongo`, and `redis` service blocks from `docker-compose.prod.yml`
2. **Update** the `backend` environment variables to point to managed service endpoints:

```yaml
# In backend service environment:
- DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@kiterp-postgres.xxxxx.ap-south-1.rds.amazonaws.com:5432/${POSTGRES_DB}
- MONGODB_URL=mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/kiterp
- REDIS_URL=redis://:${REDIS_PASSWORD}@kiterp-redis.xxxxx.cache.amazonaws.com:6379
```

1. **Remove** `depends_on` entries for postgres, mongo, redis from the backend service
2. **Remove** the volume definitions for `postgres_data`, `mongo_data`, `redis_data`

---

## Step 9: Domain and SSL Setup

### 9.1 Route 53 DNS Configuration

- **AWS Console > Route 53 > Hosted Zones > Create Hosted Zone**
- Domain: `kiterp.com`
- Update your domain registrar's nameservers to Route 53 NS records

### 9.2 DNS Records to Create

- `kiterp.com` -> A record -> EC2 Elastic IP (or ALB)
- `admin.kiterp.com` -> A record -> EC2 Elastic IP
- `vendor.kiterp.com` -> A record -> EC2 Elastic IP
- `api.kiterp.com` -> A record -> EC2 Elastic IP
- `*.kiterp.com` -> A record -> EC2 Elastic IP (wildcard for vendor storefronts)

These match the Nginx server_name blocks in [docker/nginx/conf.d/default.conf](docker/nginx/conf.d/default.conf).

### 9.3 SSL with Certbot (Free, on EC2)

SSH into EC2:

```bash
# Install Certbot
sudo dnf install certbot -y

# Stop nginx container temporarily
cd /home/ec2-user/kiterp
docker compose -f docker-compose.prod.yml stop nginx

# Get wildcard certificate (requires DNS validation)
sudo certbot certonly --manual --preferred-challenges dns \
  -d kiterp.com -d "*.kiterp.com"

# Copy certs to project's nginx ssl directory
sudo cp /etc/letsencrypt/live/kiterp.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/kiterp.com/privkey.pem docker/nginx/ssl/

# Set up auto-renewal cron
echo "0 0 1 */2 * certbot renew --quiet" | sudo crontab -
```

Then update the Nginx config in [docker/nginx/conf.d/default.conf](docker/nginx/conf.d/default.conf) to add SSL listeners (port 443) and redirect HTTP to HTTPS.

### 9.3b SSL with ALB + ACM (Alternative, Paid)

- Request a certificate in ACM for `*.kiterp.com` and `kiterp.com`
- Create an ALB pointing to the EC2 instance
- ALB handles SSL termination, Nginx receives plain HTTP

---

## Step 10: Deploy and Run

### 10.1 Run Database Migrations

```bash
cd /home/ec2-user/kiterp

# Build and start the backend only first (to run migrations)
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml run --rm backend \
  alembic upgrade head
```

### 10.2 Create Admin User

```bash
docker compose -f docker-compose.prod.yml run --rm backend \
  python create_admin.py
```

### 10.3 Start All Services

```bash
docker compose -f docker-compose.prod.yml up -d --build

# Verify all containers are healthy
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 10.4 Verify Endpoints

- `https://admin.kiterp.com` -- Admin panel
- `https://vendor.kiterp.com` -- Vendor dashboard
- `https://kiterp.com` or `https://store.kiterp.com` -- Customer storefront
- `https://api.kiterp.com/docs` -- Swagger API docs
- `https://api.kiterp.com/health` -- Health check

---

## Step 11: Post-Deployment Essentials

### 11.1 Set Up Monitoring

- **CloudWatch**: EC2 CPU/memory alarms, RDS metrics
- **Docker health checks**: Already configured in Dockerfiles and compose

### 11.2 Set Up Backups

- **RDS**: Automated daily snapshots (already enabled in Step 4)
- **S3**: Enable versioning on the uploads bucket
- **EC2**: Create AMI snapshots weekly
- **MongoDB Atlas**: Built-in backup (if using Atlas)

### 11.3 Set Up Logging

```bash
# View real-time logs
docker compose -f docker-compose.prod.yml logs -f backend

# Set up CloudWatch agent for centralized logging (optional)
```

### 11.4 Auto-Restart on EC2 Reboot

```bash
# Add to /etc/systemd/system/kiterp.service
[Unit]
Description=KITERP Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ec2-user/kiterp
ExecStart=/usr/local/lib/docker/cli-plugins/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/lib/docker/cli-plugins/docker-compose -f docker-compose.prod.yml down

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable kiterp
sudo systemctl start kiterp
```

---

## Files to Modify for Production Deployment

1. [docker-compose.prod.yml](docker-compose.prod.yml) -- remove DB containers if using managed services, update connection strings
2. [docker/nginx/conf.d/default.conf](docker/nginx/conf.d/default.conf) -- add SSL (port 443) listener blocks, HTTP-to-HTTPS redirect
3. [.env.example](/.env.example) -- add RDS/ElastiCache/Atlas endpoint variables as reference
4. Create `.env` on EC2 with real production values (never commit this file)

---

## Quick Reference: Key Commands

```bash
# Deploy/update
cd /home/ec2-user/kiterp
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Run migrations after code changes
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# Restart a specific service
docker compose -f docker-compose.prod.yml restart backend

# Check health
curl https://api.kiterp.com/health
```

