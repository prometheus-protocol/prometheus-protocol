# Verifier Bot Fleet Deployment

This directory contains everything needed to run 10 verifier bots in multiple environments:

- **Local Development**: Docker Compose (simplest)
- **Local Kubernetes**: kind (Kubernetes in Docker)
- **Production**: Any Kubernetes cluster (GKE, EKS, AKS, DigitalOcean, etc.)

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   10 Verifier Bots                      │
│  ┌──────┐ ┌──────┐ ┌──────┐           ┌──────┐        │
│  │ Bot1 │ │ Bot2 │ │ Bot3 │    ...    │ Bot10│        │
│  └──┬───┘ └──┬───┘ └──┬───┘           └──┬───┘        │
│     │        │        │                   │             │
│     └────────┴────────┴───────────────────┘             │
│                       │                                  │
│              Poll for pending jobs                       │
│                       │                                  │
└───────────────────────┼──────────────────────────────────┘
                        ▼
             ┌──────────────────────┐
             │   Audit Hub Canister │
             │  (ICP Main Network)  │
             └──────────────────────┘
```

### Key Features

- ✅ **No load balancer needed** - Bots poll, no inbound traffic
- ✅ **Simple scaling** - Each bot is independent
- ✅ **Secret management** - API keys stored securely
- ✅ **Docker socket access** - For reproducible builds
- ✅ **Auto-restart** - Bots restart on failure
- ✅ **Resource limits** - 2GB RAM, 0.5-2 CPU per bot

## 📋 Prerequisites

### For All Deployments

- Docker installed and running
- 10 verifier API keys (generated from verifier dashboard)

### For Docker Compose (Local)

- Docker Compose installed

### For kind (Local Kubernetes)

- [kind](https://kind.sigs.k8s.io/) installed
- kubectl installed

### For Production

- Access to a Kubernetes cluster
- kubectl configured with cluster credentials
- Container registry (optional, for custom images)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended for Local Dev)

**Simplest way to get started:**

```bash
# 1. Copy environment template
cd deployment
cp .env.example .env

# 2. Edit .env and add your 10 API keys
nano .env

# 3. Start all bots
./start-local.sh

# 4. View logs
docker-compose logs -f

# 5. Stop all bots
docker-compose down
```

### Option 2: kind (Local Kubernetes)

**Test Kubernetes deployment locally:**

```bash
# 1. Install kind
brew install kind  # macOS
# Or: https://kind.sigs.k8s.io/docs/user/quick-start/

# 2. Update secrets with real API keys
nano k8s/secrets.yaml

# 3. Deploy to kind
./deploy-kind.sh

# 4. View pods
kubectl get pods -n prometheus-verifiers -w

# 5. View logs
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f

# 6. Clean up
kind delete cluster --name verifier-bots
```

### Option 3: Production Kubernetes

**Deploy to any K8s cluster:**

```bash
# 1. Switch to your production context
kubectl config use-context my-production-cluster

# 2. Update secrets with real API keys
nano k8s/secrets.yaml

# 3. Deploy
./deploy-production.sh

# 4. Monitor rollout
kubectl get pods -n prometheus-verifiers -w

# 5. View logs from all bots
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f --max-log-requests=10
```

## 🔐 Secret Management

### Docker Compose

Secrets are stored in `.env` file:

```bash
VERIFIER_1_API_KEY=vr_abc123...
VERIFIER_2_API_KEY=vr_def456...
# ... etc
```

**Never commit `.env` to git!**

### Kubernetes

Secrets are stored in `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: verifier-api-keys
  namespace: prometheus-verifiers
type: Opaque
stringData:
  verifier-1-api-key: 'vr_abc123...'
  verifier-2-api-key: 'vr_def456...'
  # ... etc
```

**Best practices:**

- Use `kubectl create secret` instead of committing to git
- Use sealed-secrets or external secrets operator for GitOps
- Rotate keys regularly

Example using kubectl:

```bash
kubectl create secret generic verifier-api-keys \
  -n prometheus-verifiers \
  --from-literal=verifier-1-api-key=vr_abc123... \
  --from-literal=verifier-2-api-key=vr_def456... \
  # ... etc
```

## 📊 Monitoring & Operations

### View Logs

**Docker Compose:**

```bash
docker-compose logs -f                    # All bots
docker-compose logs -f verifier-bot-1     # Specific bot
```

**Kubernetes:**

```bash
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f --max-log-requests=10
kubectl logs -n prometheus-verifiers -l instance=verifier-1 -f
```

### Check Status

**Docker Compose:**

```bash
docker-compose ps
```

**Kubernetes:**

```bash
kubectl get pods -n prometheus-verifiers
kubectl describe pod -n prometheus-verifiers verifier-bot-1-xxx
```

### Restart a Bot

**Docker Compose:**

```bash
docker-compose restart verifier-bot-1
```

**Kubernetes:**

```bash
kubectl rollout restart deployment/verifier-bot-1 -n prometheus-verifiers
```

### Scale Up/Down

To run more or fewer bots, edit the configuration:

**Docker Compose:**

```bash
# Add/remove service definitions in docker-compose.yml
# Then restart:
docker-compose up -d
```

**Kubernetes:**

```bash
# Add/remove deployment definitions in k8s/deployments.yaml
# Then apply:
kubectl apply -f k8s/deployments.yaml
```

## 🏗️ File Structure

```
deployment/
├── .env.example              # Environment template for Docker Compose
├── docker-compose.yml        # Docker Compose config (10 bots)
├── kind-config.yaml          # kind cluster configuration
├── start-local.sh            # Start bots with Docker Compose
├── deploy-kind.sh            # Deploy to local kind cluster
├── deploy-production.sh      # Deploy to production K8s
└── k8s/                      # Kubernetes manifests
    ├── namespace.yaml        # prometheus-verifiers namespace
    ├── secrets.yaml          # API keys (update before deploying!)
    ├── configmap.yaml        # Shared configuration
    └── deployments.yaml      # 10 bot deployments
```

## 🐛 Troubleshooting

### Bot not starting

**Docker Compose:**

```bash
docker-compose logs verifier-bot-1
```

**Kubernetes:**

```bash
kubectl describe pod -n prometheus-verifiers verifier-bot-1-xxx
kubectl logs -n prometheus-verifiers verifier-bot-1-xxx
```

Common issues:

- Missing or invalid API key
- Docker socket not accessible
- Insufficient resources (need 2GB RAM per bot)

### Docker socket permission denied

**Solution:** Ensure the bot container has access to `/var/run/docker.sock`

**Docker Compose:** Already configured in `docker-compose.yml`

**Kubernetes:** Worker nodes must have Docker installed and socket mounted

### Bots not processing jobs

1. Check logs for errors
2. Verify API keys are valid
3. Confirm network connectivity to ICP
4. Check if there are pending jobs: `dfx canister call audit_hub list_pending_verifications`

### Out of memory errors

Increase resource limits:

**Docker Compose:** Add to service definition:

```yaml
deploy:
  resources:
    limits:
      memory: 8G
```

**Kubernetes:** Edit `k8s/deployments.yaml`:

```yaml
resources:
  limits:
    memory: '8Gi'
```

## 🚢 Production Deployment Options

### Option A: Managed Kubernetes (Recommended)

**DigitalOcean Kubernetes ($12/month for 2 nodes):**

```bash
doctl kubernetes cluster create verifier-bots \
  --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=2"

doctl kubernetes cluster kubeconfig save verifier-bots
./deploy-production.sh
```

**Google Kubernetes Engine (GKE):**

```bash
gcloud container clusters create verifier-bots \
  --num-nodes=2 \
  --machine-type=e2-standard-2

gcloud container clusters get-credentials verifier-bots
./deploy-production.sh
```

**AWS EKS:**

```bash
eksctl create cluster \
  --name verifier-bots \
  --nodes 2 \
  --node-type t3.medium

aws eks update-kubeconfig --name verifier-bots
./deploy-production.sh
```

### Option B: Docker on VPS

If you prefer simpler infrastructure, just use Docker Compose on a VPS:

**DigitalOcean Droplet ($24/month for 4GB RAM):**

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repo
git clone https://github.com/prometheus-protocol/prometheus-protocol.git
cd prometheus-protocol/packages/apps/verifier-bot/deployment

# Configure
cp .env.example .env
nano .env  # Add API keys

# Start
./start-local.sh
```

## 🔄 Updates & Maintenance

### Update Bot Code

**Docker Compose:**

```bash
git pull origin main
cd packages/apps/verifier-bot
pnpm build
cd deployment
docker-compose build
docker-compose up -d
```

**Kubernetes:**

```bash
# Build and push new image
docker build -t ghcr.io/prometheus-protocol/verifier-bot:latest .
docker push ghcr.io/prometheus-protocol/verifier-bot:latest

# Update deployment (will auto-pull new image)
kubectl rollout restart deployment -n prometheus-verifiers -l app=verifier-bot
```

### Backup Configuration

```bash
# Export secrets
kubectl get secret verifier-api-keys -n prometheus-verifiers -o yaml > secrets-backup.yaml

# Export all configs
kubectl get all,configmaps,secrets -n prometheus-verifiers -o yaml > full-backup.yaml
```

## 💰 Cost Estimates

### Docker Compose on VPS

- **DigitalOcean**: $24/month (4GB RAM, 2 vCPU)
- **AWS EC2**: ~$30/month (t3.medium)
- **Pros**: Simple, no orchestration overhead
- **Cons**: Manual scaling, no auto-healing

### Kubernetes Cluster

- **DigitalOcean**: $12-24/month (2-4 node cluster)
- **GKE**: ~$50/month (2 node cluster)
- **AWS EKS**: ~$80/month (cluster fee + nodes)
- **Pros**: Auto-scaling, self-healing, professional
- **Cons**: More complex, higher cost

### Recommendation

- **Development**: Docker Compose or kind (free)
- **Small Production**: Docker Compose on VPS ($24/mo)
- **Large Production**: Kubernetes on DigitalOcean ($12-24/mo)

## 📚 Additional Resources

- [Verifier Bot README](../README.md) - Main documentation
- [kind Documentation](https://kind.sigs.k8s.io/) - Local Kubernetes
- [Docker Compose Docs](https://docs.docker.com/compose/) - Container orchestration
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/) - K8s commands

## 🤝 Support

If you encounter issues:

1. Check logs first (see Monitoring section)
2. Review troubleshooting section
3. Ask in Discord #dev channel
4. Open GitHub issue with logs

---

**Happy verifying! 🚀**
