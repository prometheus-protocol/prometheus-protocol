# Verifier Bot Fleet - Quick Reference

## 🚀 Quick Commands

### Docker Compose (Local Dev)

```bash
cd deployment
cp .env.example .env && nano .env    # Configure API keys
./start-local.sh                      # Start all bots
docker-compose logs -f                # View logs
docker-compose ps                     # Check status
docker-compose restart verifier-bot-1 # Restart one bot
docker-compose down                   # Stop all bots
```

### kind (Local Kubernetes)

```bash
cd deployment
nano k8s/secrets.yaml                           # Configure API keys
./deploy-kind.sh                                # Deploy to kind
kubectl get pods -n prometheus-verifiers -w     # Watch pods
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f  # View logs
kind delete cluster --name verifier-bots        # Clean up
```

### Production Kubernetes

```bash
cd deployment
nano k8s/secrets.yaml                           # Configure API keys
kubectl config use-context my-cluster           # Switch context
./deploy-production.sh                          # Deploy to production
kubectl get pods -n prometheus-verifiers -w     # Watch pods
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f  # View logs
```

## 🔍 Monitoring

### Check Bot Status

```bash
# Docker Compose
docker-compose ps

# Kubernetes
kubectl get pods -n prometheus-verifiers
```

### View Logs

```bash
# Docker Compose - All bots
docker-compose logs -f

# Docker Compose - Specific bot
docker-compose logs -f verifier-bot-1

# Kubernetes - All bots
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f --max-log-requests=10

# Kubernetes - Specific bot
kubectl logs -n prometheus-verifiers -l instance=verifier-1 -f
```

### Debugging

```bash
# Docker Compose
docker-compose exec verifier-bot-1 sh
docker-compose logs verifier-bot-1 --tail=100

# Kubernetes
kubectl describe pod -n prometheus-verifiers verifier-bot-1-xxx
kubectl exec -it -n prometheus-verifiers verifier-bot-1-xxx -- sh
```

## 🔄 Updates

### Update Docker Compose

```bash
git pull
cd packages/apps/verifier-bot
pnpm build
cd deployment
docker-compose build
docker-compose up -d
```

### Update Kubernetes

```bash
# Rebuild and push image
docker build -t ghcr.io/prometheus-protocol/verifier-bot:latest .
docker push ghcr.io/prometheus-protocol/verifier-bot:latest

# Restart all deployments
kubectl rollout restart deployment -n prometheus-verifiers -l app=verifier-bot

# Check rollout status
kubectl rollout status deployment/verifier-bot-1 -n prometheus-verifiers
```

## 🔐 Managing Secrets

### View Current Secrets (Kubernetes)

```bash
kubectl get secret verifier-api-keys -n prometheus-verifiers -o yaml
```

### Update Secrets (Kubernetes)

```bash
kubectl delete secret verifier-api-keys -n prometheus-verifiers
kubectl create secret generic verifier-api-keys -n prometheus-verifiers \
  --from-literal=verifier-1-api-key=vr_newkey1... \
  --from-literal=verifier-2-api-key=vr_newkey2...
  # ... add all 10 keys

# Restart deployments to pick up new secrets
kubectl rollout restart deployment -n prometheus-verifiers -l app=verifier-bot
```

## 🧹 Cleanup

### Docker Compose

```bash
docker-compose down                # Stop bots
docker-compose down -v             # Stop and remove volumes
docker system prune -a             # Clean up images
```

### kind

```bash
kind delete cluster --name verifier-bots
```

### Production Kubernetes

```bash
kubectl delete namespace prometheus-verifiers  # Delete all resources
```

## 📊 Resource Usage

### Per Bot

- **CPU**: 0.5-2.0 cores (during builds)
- **Memory**: 2-4 GB RAM
- **Disk**: Minimal (Docker images cached)
- **Network**: Low (only API calls to ICP)

### Total for 10 Bots

- **CPU**: 5-20 cores
- **Memory**: 20-40 GB RAM
- **Recommended VPS**: 4+ vCPU, 16+ GB RAM

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           10 Independent Bots               │
│  Each polls audit hub every 60 seconds     │
│  No coordination needed between bots        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │  Audit Hub      │
        │  (ICP Canister) │
        └─────────────────┘
```

**Key Points:**

- No inbound traffic = No load balancer needed
- Each bot is independent = Easy scaling
- Bots poll = Simple networking
- Docker socket access = For reproducible builds

## 🚨 Common Issues

### "Cannot connect to Docker daemon"

**Solution:** Ensure `/var/run/docker.sock` is mounted

```bash
# Docker Compose: Already configured
# Kubernetes: Check worker nodes have Docker
```

### "API key invalid"

**Solution:** Generate new keys from verifier dashboard

```bash
# Update .env (Docker Compose) or secrets.yaml (K8s)
# Restart bots
```

### "Out of memory"

**Solution:** Increase resource limits or reduce concurrent bots

```bash
# Edit resources in docker-compose.yml or k8s/deployments.yaml
```

### "No jobs being processed"

**Solution:** Check there are pending verifications

```bash
dfx canister call audit_hub list_pending_verifications
```

## 📞 Support

- **Documentation**: [deployment/README.md](./README.md)
- **Discord**: #dev channel
- **Issues**: GitHub Issues

---

**Quick start:** `cp .env.example .env && nano .env && ./start-local.sh`
