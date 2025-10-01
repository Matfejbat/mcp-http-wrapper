# Deployment Guide

This guide covers various deployment options for the MCP HTTP Wrapper, from local development to production cloud deployments.

## Table of Contents

- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment Options](#cloud-deployment-options)
  - [Railway.app](#railwayapp)
  - [Fly.io](#flyio)
  - [AWS ECS/Fargate](#aws-ecsfargate)
  - [Google Cloud Run](#google-cloud-run)
  - [DigitalOcean App Platform](#digitalocean-app-platform)
  - [Your Own VPS](#your-own-vps)
- [Ngrok for Local Testing](#ngrok-for-local-testing)
- [Security Considerations](#security-considerations)
- [Monitoring and Logging](#monitoring-and-logging)

---

## Local Development

### Prerequisites
- Node.js 18+ installed
- Your `claude_desktop_config.json` file
- MCP servers installed and configured

### Steps

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start the server:**
```bash
npm start
```

4. **Test the API:**
```bash
# Health check
curl http://localhost:3000/health

# List tools (with auth)
curl -H "X-API-Key: your-api-key" \
  http://localhost:3000/servers/filesystem/tools
```

### Development Mode with Auto-Reload

```bash
npm install -D nodemon
npm run dev
```

---

## Docker Deployment

### Using Docker

**Create `Dockerfile`:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/server.js"]
```

**Create `docker-compose.yml`:**

```yaml
version: '3.8'

services:
  mcp-wrapper:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    volumes:
      - ./claude_desktop_config.json:/app/claude_desktop_config.json:ro
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

**Build and Run:**

```bash
# Build image
docker build -t mcp-http-wrapper .

# Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/claude_desktop_config.json:/app/claude_desktop_config.json:ro \
  --name mcp-wrapper \
  mcp-http-wrapper

# Or use docker-compose
docker-compose up -d
```

**View logs:**
```bash
docker logs -f mcp-wrapper
```

---

## Cloud Deployment Options

### Railway.app

**Easiest deployment option with persistent storage**

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
railway login
```

2. **Initialize project:**
```bash
railway init
```

3. **Configure environment variables:**
```bash
railway variables set API_KEY=your-secret-key
railway variables set PORT=3000
railway variables set NODE_ENV=production
```

4. **Deploy:**
```bash
railway up
```

5. **Get URL:**
```bash
railway domain
```

**Pricing:** Free tier available, pay-as-you-go starting at $5/month

---

### Fly.io

**Global edge deployment with automatic scaling**

1. **Install Fly CLI:**
```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

2. **Create `fly.toml`:**
```toml
app = "mcp-http-wrapper"
primary_region = "iad"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

3. **Set secrets:**
```bash
fly secrets set API_KEY=your-secret-key
```

4. **Deploy:**
```bash
fly launch
fly deploy
```

5. **View logs:**
```bash
fly logs
```

**Pricing:** Free tier includes 3 shared CPU VMs with 256MB RAM

---

### AWS ECS/Fargate

**Enterprise-grade serverless container deployment**

1. **Create ECR repository:**
```bash
aws ecr create-repository --repository-name mcp-http-wrapper
```

2. **Build and push Docker image:**
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t mcp-http-wrapper .
docker tag mcp-http-wrapper:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-http-wrapper:latest

# Push
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-http-wrapper:latest
```

3. **Create task definition:**
```json
{
  "family": "mcp-http-wrapper",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "mcp-wrapper",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-http-wrapper:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/mcp-http-wrapper",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

4. **Create ECS service with Application Load Balancer**

5. **Configure auto-scaling based on CPU/memory usage**

**Pricing:** Pay for what you use, approximately $0.04/hour for 0.25 vCPU + 0.5GB RAM

---

### Google Cloud Run

**Serverless containers that scale to zero**

1. **Install gcloud CLI:**
```bash
curl https://sdk.cloud.google.com | bash
gcloud init
```

2. **Build and deploy:**
```bash
# Build using Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/mcp-http-wrapper

# Deploy to Cloud Run
gcloud run deploy mcp-http-wrapper \
  --image gcr.io/YOUR_PROJECT_ID/mcp-http-wrapper \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets API_KEY=api-key:latest \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

3. **Get URL:**
```bash
gcloud run services describe mcp-http-wrapper --region us-central1
```

**Pricing:** Free tier includes 2 million requests/month, then $0.40/million requests

---

### DigitalOcean App Platform

**Simple PaaS with predictable pricing**

1. **Create app from GitHub:**
   - Connect your GitHub repository
   - Select Node.js buildpack
   - Set environment variables

2. **Or use `doctl` CLI:**
```bash
doctl apps create --spec app-spec.yaml
```

**`app-spec.yaml`:**
```yaml
name: mcp-http-wrapper
services:
- name: api
  github:
    repo: your-username/mcp-http-wrapper
    branch: main
  build_command: npm install
  run_command: npm start
  environment_slug: node-js
  instance_size_slug: basic-xxs
  instance_count: 1
  http_port: 3000
  routes:
  - path: /
  envs:
  - key: API_KEY
    scope: RUN_TIME
    value: ${API_KEY}
  - key: NODE_ENV
    value: production
```

**Pricing:** Starting at $5/month for basic instances

---

### Your Own VPS

**Full control deployment on Ubuntu/Debian**

1. **SSH into your server:**
```bash
ssh user@your-server-ip
```

2. **Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Clone repository:**
```bash
cd /opt
sudo git clone https://github.com/your-username/mcp-http-wrapper.git
cd mcp-http-wrapper
sudo npm install --production
```

4. **Create systemd service:**
```bash
sudo nano /etc/systemd/system/mcp-wrapper.service
```

```ini
[Unit]
Description=MCP HTTP Wrapper
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mcp-http-wrapper
ExecStart=/usr/bin/node /opt/mcp-http-wrapper/src/server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/mcp-http-wrapper/.env

[Install]
WantedBy=multi-user.target
```

5. **Enable and start service:**
```bash
sudo systemctl enable mcp-wrapper
sudo systemctl start mcp-wrapper
sudo systemctl status mcp-wrapper
```

6. **Setup Nginx reverse proxy:**
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/mcp-wrapper
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mcp-wrapper /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

7. **Setup SSL with Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Ngrok for Local Testing

**Expose your local server for testing with external services**

1. **Install ngrok:**
```bash
npm install -g ngrok
# Or download from https://ngrok.com
```

2. **Start your server:**
```bash
npm start
```

3. **Create tunnel:**
```bash
ngrok http 3000
```

4. **Use the provided URL:**
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
```

**Note:** Free tier provides temporary URLs that change on restart. Paid plans offer reserved domains.

---

## Security Considerations

### Before Production Deployment

- ✅ **Set strong API key:** Use at least 32 random characters
- ✅ **Enable HTTPS:** Always use TLS/SSL in production
- ✅ **Configure CORS:** Limit allowed origins
- ✅ **Enable rate limiting:** Prevent abuse
- ✅ **Use environment variables:** Never commit secrets
- ✅ **Implement request logging:** Monitor access patterns
- ✅ **Set up firewall rules:** Restrict access to necessary ports
- ✅ **Regular updates:** Keep dependencies up to date
- ✅ **IP whitelisting:** If possible, restrict to known IPs
- ✅ **Add monitoring:** Set up health checks and alerts

### Environment Variables Checklist

```bash
# Required
API_KEY=<strong-random-key>
NODE_ENV=production
PORT=3000

# Optional but recommended
ALLOWED_ORIGINS=https://watsonx.cloud.ibm.com
LOG_LEVEL=info
REQUEST_TIMEOUT=30000
MAX_REQUEST_SIZE=10mb
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

---

## Monitoring and Logging

### Application Logs

**View logs in different environments:**

```bash
# Local
tail -f logs/app.log

# Docker
docker logs -f mcp-wrapper

# Systemd
sudo journalctl -u mcp-wrapper -f

# Cloud platforms
# Railway: railway logs
# Fly.io: fly logs
# Cloud Run: gcloud run services logs read
```

### Health Checks

Set up external monitoring:

- **UptimeRobot** (free): Monitor `/health` endpoint
- **Better Uptime**: Advanced monitoring with alerts
- **Datadog**: Full observability platform
- **New Relic**: APM and monitoring

### Example Health Check Configuration

```yaml
# Kubernetes/Docker Compose health check
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 5s
```

---

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

**MCP servers not starting:**
- Check `claude_desktop_config.json` paths
- Verify Node.js/Python versions for MCP servers
- Check stderr logs for error messages

**High memory usage:**
- Monitor with `docker stats` or `htop`
- Adjust Docker memory limits
- Consider horizontal scaling

**Connection timeouts:**
- Increase `REQUEST_TIMEOUT` in .env
- Check network connectivity
- Verify firewall rules

---

## Next Steps

- Configure [WatsonX integration](./WATSONX_SETUP.md)
- Set up [monitoring and alerts](./MONITORING.md)
- Review [security best practices](./SECURITY.md)
- Explore [scaling strategies](./SCALING.md)

## Support

For issues and questions:
- GitHub Issues: https://github.com/Matfejbat/mcp-http-wrapper/issues
- Documentation: https://github.com/Matfejbat/mcp-http-wrapper/docs
