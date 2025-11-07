# Complete Verifier Bot Fleet Setup

## 📁 What You've Got

A complete deployment system for running 10 verifier bots with three deployment options:

```
packages/apps/verifier-bot/deployment/
├── 📋 README.md                  # Full documentation
├── ⚡ QUICKSTART.md              # Quick reference commands
├── 🔧 .env.example               # Environment template
├── 📦 docker-compose.yml         # Docker Compose config (10 bots)
├── 🎯 kind-config.yaml           # Local Kubernetes cluster config
├── 🚀 start-local.sh             # Start with Docker Compose
├── 🧪 deploy-kind.sh             # Deploy to local Kubernetes
├── 🌐 deploy-production.sh       # Deploy to production Kubernetes
└── k8s/                          # Kubernetes manifests
    ├── namespace.yaml            # Namespace definition
    ├── secrets.yaml              # API keys storage
    ├── configmap.yaml            # Shared configuration
    └── deployments.yaml          # 10 bot deployments
```

## 🎯 Choose Your Deployment Method

### 1️⃣ Docker Compose (Easiest - Recommended for Local Dev)

**Best for:** Local development, testing, small production deployments

**Pros:**
✅ Simplest setup - just 3 commands
✅ No Kubernetes knowledge needed
✅ Works on any machine with Docker
✅ Perfect for testing with local dfx replica

**Cons:**
❌ Manual scaling
❌ No auto-healing
❌ Single machine only

**Quick Start:**

```bash
cd deployment
cp .env.example .env
nano .env  # Add your 10 API keys
./start-local.sh
```

---

### 2️⃣ kind (Local Kubernetes - Best for Testing K8s)

**Best for:** Testing Kubernetes deployment locally before production

**Pros:**
✅ Real Kubernetes environment
✅ Free and runs on your laptop
✅ Identical to production K8s experience
✅ Great for learning K8s

**Cons:**
❌ Requires kind + kubectl installation
❌ More complex than Docker Compose
❌ Not meant for actual production

**Quick Start:**

```bash
# Install kind
brew install kind kubectl  # macOS
# Or: https://kind.sigs.k8s.io/

cd deployment
nano k8s/secrets.yaml  # Add your 10 API keys
./deploy-kind.sh
```

---

### 3️⃣ Production Kubernetes (Best for Production)

**Best for:** Production deployments, high availability, large scale

**Pros:**
✅ Auto-scaling and self-healing
✅ Professional deployment
✅ Works with any cloud provider
✅ Easy updates and rollbacks

**Cons:**
❌ Costs money (cluster fees)
❌ Requires K8s cluster setup
❌ More complex operations

**Quick Start:**

```bash
# After setting up your K8s cluster...
cd deployment
nano k8s/secrets.yaml  # Add your 10 API keys
kubectl config use-context my-cluster
./deploy-production.sh
```

## 🔐 Getting API Keys (Required for All Methods)

Before deploying, you need 10 API keys:

1. **Visit the verifier dashboard** at your app store URL
2. **Create 10 verifier accounts** (or use 10 different identities)
3. **Deposit USDC stake** into each account (e.g., 50-100 USDC)
4. **Generate API keys** for each account
5. **Save the keys** - you'll need them for configuration

Each API key looks like: `vr_0123456789abcdef0123456789abcdef`

## ⚙️ Configuration Guide

### Docker Compose Configuration

Edit `deployment/.env`:

```bash
# Network - use 'local' for development, 'ic' for production
IC_NETWORK=local

# Polling - how often to check for jobs (milliseconds)
POLL_INTERVAL_MS=60000

# Timeout - max time for a build (milliseconds)
BUILD_TIMEOUT_MS=600000

# API Keys - one for each bot
VERIFIER_1_API_KEY=vr_your_actual_key_here_1
VERIFIER_2_API_KEY=vr_your_actual_key_here_2
# ... up to VERIFIER_10_API_KEY
```

### Kubernetes Configuration

Edit `deployment/k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: verifier-api-keys
  namespace: prometheus-verifiers
type: Opaque
stringData:
  verifier-1-api-key: 'vr_your_actual_key_here_1'
  verifier-2-api-key: 'vr_your_actual_key_here_2'
  # ... up to verifier-10-api-key
```

Edit `deployment/k8s/configmap.yaml` (optional):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: verifier-config
  namespace: prometheus-verifiers
data:
  IC_NETWORK: 'ic' # or "local"
  POLL_INTERVAL_MS: '60000'
  BUILD_TIMEOUT_MS: '600000'
```

## 🚀 Step-by-Step Setup

### Method 1: Docker Compose

```bash
# 1. Navigate to deployment directory
cd packages/apps/verifier-bot/deployment

# 2. Create environment file
cp .env.example .env

# 3. Edit with your API keys
nano .env
# Replace all VERIFIER_X_API_KEY values
# Set IC_NETWORK=local (for dev) or ic (for prod)

# 4. Start all 10 bots
./start-local.sh

# 5. Verify they're running
docker-compose ps

# 6. Watch the logs
docker-compose logs -f

# 7. Stop when done
docker-compose down
```

### Method 2: kind (Local Kubernetes)

```bash
# 1. Install prerequisites
brew install kind kubectl  # macOS
# Linux: https://kind.sigs.k8s.io/docs/user/quick-start/

# 2. Navigate to deployment directory
cd packages/apps/verifier-bot/deployment

# 3. Configure secrets
nano k8s/secrets.yaml
# Replace all REPLACE_WITH_ACTUAL_KEY values

# 4. Optionally configure network
nano k8s/configmap.yaml
# Change IC_NETWORK to "local" or "ic"

# 5. Deploy to kind
./deploy-kind.sh

# 6. Wait for pods to be ready
kubectl get pods -n prometheus-verifiers -w

# 7. View logs from all bots
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f

# 8. Clean up when done
kind delete cluster --name verifier-bots
```

### Method 3: Production Kubernetes

```bash
# 1. Set up your Kubernetes cluster
# (DigitalOcean, GKE, EKS, AKS, etc.)

# 2. Get cluster credentials
# DigitalOcean: doctl kubernetes cluster kubeconfig save <cluster-name>
# GKE: gcloud container clusters get-credentials <cluster-name>
# EKS: aws eks update-kubeconfig --name <cluster-name>

# 3. Verify connection
kubectl cluster-info
kubectl get nodes

# 4. Navigate to deployment directory
cd packages/apps/verifier-bot/deployment

# 5. Configure secrets with REAL API keys
nano k8s/secrets.yaml
# Replace all REPLACE_WITH_ACTUAL_KEY values

# 6. Configure for production
nano k8s/configmap.yaml
# Set IC_NETWORK: "ic"

# 7. Deploy to production
./deploy-production.sh

# 8. Monitor the rollout
kubectl get pods -n prometheus-verifiers -w

# 9. Check logs
kubectl logs -n prometheus-verifiers -l app=verifier-bot -f --max-log-requests=10

# 10. Verify bots are working
kubectl logs -n prometheus-verifiers -l instance=verifier-1 -f
# Look for: "✅ Verifier Bot is now running"
```

## 🔍 Verification Checklist

After deployment, verify everything is working:

### Docker Compose

```bash
✅ All 10 containers running: docker-compose ps
✅ No errors in logs: docker-compose logs --tail=50
✅ Bots polling: Look for "🔍 Polling for pending verifications..."
✅ API keys valid: No "API key invalid" errors
✅ Network connectivity: Bots can reach ICP network
```

### Kubernetes

```bash
✅ All 10 pods running: kubectl get pods -n prometheus-verifiers
✅ Pods are healthy: kubectl get pods -n prometheus-verifiers | grep Running
✅ No errors: kubectl logs -n prometheus-verifiers -l app=verifier-bot --tail=50
✅ Secrets loaded: kubectl describe pod -n prometheus-verifiers <pod-name>
✅ Bots polling: kubectl logs -n prometheus-verifiers -l instance=verifier-1 -f
```

## 📊 Expected Log Output

When bots are working correctly, you should see:

```
🤖 Prometheus Protocol Verifier Bot
====================================
🔑 API Key: vr_abc123...
🌐 Network: ic
⏱️  Poll Interval: 60000ms
====================================

🚀 Verifier Bot is starting...
✅ Verifier Bot is now running
   Polling every 60 seconds

🔍 [2025-11-05T10:00:00.000Z] Polling for pending verifications...
   Found 0 pending verification(s)

🔍 [2025-11-05T10:01:00.000Z] Polling for pending verifications...
   Found 1 pending verification(s)
   🔍 Checking bounties for WASM: abc123...
   📋 Found 1 bounties for this WASM

🎯 Processing verification job
   WASM Hash: abc123...
   Repo: https://github.com/user/project
   Commit: def456...
   Bounty ID: 1
   Reward: 1000000 tokens

🔒 Reserving bounty with API key...
   ✅ Bounty reserved, stake locked for 1 hour

🔨 Starting reproducible build...
📊 Build completed in 45s
✅ Build verified! Hash matches. Filing attestation...
   ✅ Attestation filed successfully
   ⏳ Waiting for 5-of-9 consensus...
```

## 🐛 Troubleshooting

### Problem: "VERIFIER_API_KEY environment variable is required"

**Solution:** Make sure you've configured API keys in `.env` (Docker Compose) or `k8s/secrets.yaml` (Kubernetes)

### Problem: "Cannot connect to Docker daemon"

**Solution:**

- Docker Compose: Make sure Docker is running
- Kubernetes: Worker nodes need Docker installed

### Problem: Bots start but don't process jobs

**Solution:**

- Verify API keys are valid
- Check there are pending verifications: `dfx canister call audit_hub list_pending_verifications`
- Ensure network is set correctly (local vs ic)

### Problem: Out of memory errors

**Solution:**

- Reduce number of concurrent bots
- Increase memory limits in configuration
- Use larger VPS/cluster nodes

## 💰 Cost Comparison

### Docker Compose on VPS

- **DigitalOcean Droplet**: $24/month (4GB RAM, 2 vCPU)
- **Simple and cheap**
- **Good for:** Small operations, testing, personal use

### kind (Local)

- **FREE** (runs on your laptop)
- **Good for:** Testing, development, learning

### Kubernetes Cluster

- **DigitalOcean**: $12-24/month
- **GKE**: ~$50/month
- **EKS**: ~$80/month
- **Good for:** Production, high availability, scaling

## 🔄 Next Steps

1. ✅ **Verify bots are running** (see checklist above)
2. 📊 **Monitor for 24 hours** - Watch for errors
3. 🎯 **Test with real jobs** - Publish a test WASM
4. 🔐 **Rotate API keys** - Set up key rotation schedule
5. 📈 **Scale if needed** - Add more bots or resources
6. 🚨 **Set up alerts** - Monitor bot health

## 📚 Additional Resources

- **Full Documentation**: [README.md](./README.md)
- **Quick Reference**: [QUICKSTART.md](./QUICKSTART.md)
- **Main Bot README**: [../README.md](../README.md)
- **kind Docs**: https://kind.sigs.k8s.io/
- **Docker Compose Docs**: https://docs.docker.com/compose/
- **Kubernetes Docs**: https://kubernetes.io/docs/

## 🆘 Need Help?

- 💬 Discord: #dev channel
- 🐛 GitHub Issues: Report bugs or ask questions
- 📧 Email: support@prometheus-protocol.com

---

**You're all set! Choose your deployment method above and get started. 🚀**
