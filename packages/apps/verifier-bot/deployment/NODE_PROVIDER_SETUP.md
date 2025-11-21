# Verifier Bot Setup for Node Providers

This guide is for external node providers running verifier bots on their own infrastructure.

## ✅ Prerequisites

- Docker and Docker Compose installed
- Verifier API keys (created in the App Store on Prometheus Protocol)
- Optional: GitHub token to increase rate limits (if running multiple bots or high volume)

## 🚀 Quick Start (5 minutes)

### 1. Download the configuration files

```bash
# Create a directory for your verifier setup
mkdir ~/prometheus-verifiers
cd ~/prometheus-verifiers

# Download the docker-compose file
curl -O https://raw.githubusercontent.com/prometheus-protocol/prometheus-protocol/main/packages/apps/verifier-bot/deployment/docker-compose-dind.yml

# Download the .env template
curl -O https://raw.githubusercontent.com/prometheus-protocol/prometheus-protocol/main/packages/apps/verifier-bot/deployment/.env.example
```

### 2. Configure your API keys

```bash
# Copy the template
cp .env.example .env

# Edit and add your API keys
nano .env
```

**Important:** Update these values in `.env`:

```bash
IC_NETWORK=ic  # Must be 'ic' for production
GITHUB_TOKEN=your_github_token_here  # Required for multiple bots or high volume usage

# Replace these with your real API keys from Prometheus Protocol
VERIFIER_1_API_KEY=vr_your_real_key_here
VERIFIER_2_API_KEY=vr_your_real_key_here
# ... etc for all 10 keys
```

### 3. Start the verifiers

**Option A: Start just one bot first (recommended for testing)**

```bash
# Start only verifier-bot-1 and its Docker daemon
docker-compose -f docker-compose-dind.yml up -d verifier-bot-1 dind-1

# Check it's running
docker-compose -f docker-compose-dind.yml ps

# Watch logs in real-time
docker-compose -f docker-compose-dind.yml logs -f verifier-bot-1

# Check last 50 lines of logs
docker-compose -f docker-compose-dind.yml logs --tail=50 verifier-bot-1
```

**Option B: Start all 10 verifiers**

```bash
docker-compose -f docker-compose-dind.yml up -d
```

### 4. Verify they're running

```bash
# Check all containers are running
docker-compose -f docker-compose-dind.yml ps

# View logs from all verifiers
docker-compose -f docker-compose-dind.yml logs -f

# View logs from a specific verifier
docker-compose -f docker-compose-dind.yml logs -f verifier-bot-1

# View last 100 lines from a specific verifier
docker-compose -f docker-compose-dind.yml logs --tail=100 verifier-bot-1
```

You should see output like:

```
verifier-bot-1  | 🤖 Verifier Bot Starting...
verifier-bot-1  | 🔑 Using API key: vr_****...
verifier-bot-1  | 🌐 Network: ic
verifier-bot-1  | 🔍 Polling for jobs every 60000ms
verifier-bot-1  | ✅ Verifier bot initialized
```

## 📊 Monitoring

### Check Status

```bash
# See which containers are running
docker-compose -f docker-compose-dind.yml ps

# See resource usage (all containers)
docker stats

# See resource usage for specific verifier
docker stats verifier-bot-1 dind-1
```

### View Logs

```bash
# All verifiers (follow mode)
docker-compose -f docker-compose-dind.yml logs -f

# Specific verifier (follow mode)
docker-compose -f docker-compose-dind.yml logs -f verifier-bot-1

# Last 100 lines from specific verifier
docker-compose -f docker-compose-dind.yml logs --tail=100 verifier-bot-1

# Last 100 lines from all verifiers
docker-compose -f docker-compose-dind.yml logs --tail=100

# Search logs for specific text
docker-compose -f docker-compose-dind.yml logs verifier-bot-1 | grep "Build completed"
```

### Restart Individual Bots

```bash
# Restart a specific bot
docker-compose -f docker-compose-dind.yml restart verifier-bot-1

# Restart a specific bot and its dind container
docker-compose -f docker-compose-dind.yml restart verifier-bot-1 dind-1

# Restart all bots
docker-compose -f docker-compose-dind.yml restart
```

### Stop Individual Bots

```bash
# Stop a specific bot (keeps data)
docker-compose -f docker-compose-dind.yml stop verifier-bot-1 dind-1

# Start it again
docker-compose -f docker-compose-dind.yml start verifier-bot-1 dind-1

# Remove a specific bot completely
docker-compose -f docker-compose-dind.yml down verifier-bot-1 dind-1
```

## 🔄 Updates

When Prometheus Protocol releases a new version:

```bash
cd ~/prometheus-verifiers

# Pull the latest image
docker-compose -f docker-compose-dind.yml pull

# Restart all verifiers with new image
docker-compose -f docker-compose-dind.yml up -d
```

## 🛑 Stopping

```bash
# Stop all verifiers (keeps data)
docker-compose -f docker-compose-dind.yml down

# Stop and remove all data/volumes
docker-compose -f docker-compose-dind.yml down -v
```

## 🐛 Troubleshooting

### "Cannot connect to Docker daemon"

**This should NOT happen with docker-compose-dind.yml** because it uses Docker-in-Docker (no host Docker socket required).

If you still see this error:

1. Make sure you're using `docker-compose-dind.yml` (NOT `docker-compose.yml`)
2. Check that Docker is running: `docker ps`
3. Try restarting: `docker-compose -f docker-compose-dind.yml restart`

### "API key invalid"

Your API key might be incorrect or expired. Contact Prometheus Protocol team for new keys.

### "No jobs being processed"

This is normal if there are no pending verification jobs. The bots will automatically pick up jobs when they become available.

### High CPU/Memory Usage

Each verifier bot needs:

- **2-4 GB RAM** (during builds)
- **1-2 CPU cores** (during builds)

For 10 bots, recommended minimum:

- **16 GB RAM**
- **8 CPU cores**

You can reduce the number of running bots by commenting out services in the docker-compose file.

### Containers Keep Restarting

```bash
# Check the logs for errors
docker-compose -f docker-compose-dind.yml logs --tail=50 verifier-bot-1

# Common issues:
# - Invalid API key
# - Network connectivity to ic0.app
# - Insufficient resources (RAM/CPU)
```

## 📈 Resource Requirements

### Per Bot

- CPU: 0.5-2 cores (spikes during builds)
- Memory: 512 MB idle, 2-4 GB during builds
- Disk: ~2 GB for Docker images + build cache
- Network: Low (only API calls to ICP)

### For 10 Bots

- **Minimum:** 8 vCPU, 16 GB RAM, 50 GB disk
- **Recommended:** 12 vCPU, 32 GB RAM, 100 GB disk

## 🔐 Security Notes

- The `.env` file contains your API keys - **never commit it to git**
- Each dind container runs in privileged mode (required for Docker-in-Docker)
- Verifiers only make outbound connections (no inbound traffic needed)
- No ports need to be exposed

## 💬 Support

- **Issues:** Contact Prometheus Protocol team via Discord
- **Documentation:** https://github.com/prometheus-protocol/prometheus-protocol
- **Logs:** Always include recent logs when reporting issues

## 🎯 Architecture

This setup uses **Docker-in-Docker (dind)**:

```
┌─────────────────────────────────────┐
│  Your Host Machine                  │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ verifier-bot-1 container       │ │
│  │ connects to dind-1 via TCP     │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ dind-1 container               │ │
│  │ (runs Docker daemon)           │ │
│  │ tcp://localhost:2375           │ │
│  └────────────────────────────────┘ │
│                                      │
│  ... repeat for bots 2-10 ...       │
└─────────────────────────────────────┘
```

**Why dind?**

- ✅ No Docker socket permission issues
- ✅ Works on any host OS
- ✅ Better isolation between verifiers
- ✅ Same setup as production Kubernetes

---

**Quick commands reference:**

```bash
# Start just one bot for testing
docker-compose -f docker-compose-dind.yml up -d verifier-bot-1 dind-1

# Check if it's running
docker-compose -f docker-compose-dind.yml ps

# View logs (follow mode)
docker-compose -f docker-compose-dind.yml logs -f verifier-bot-1

# View last 50 lines
docker-compose -f docker-compose-dind.yml logs --tail=50 verifier-bot-1

# Start all bots
docker-compose -f docker-compose-dind.yml up -d

# Status
docker-compose -f docker-compose-dind.yml ps

# Logs from all bots
docker-compose -f docker-compose-dind.yml logs -f

# Restart specific bot
docker-compose -f docker-compose-dind.yml restart verifier-bot-1

# Stop all
docker-compose -f docker-compose-dind.yml down

# Update to latest version
docker-compose -f docker-compose-dind.yml pull
docker-compose -f docker-compose-dind.yml up -d
```
