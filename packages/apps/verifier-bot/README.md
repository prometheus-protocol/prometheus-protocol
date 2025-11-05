# Verifier Bot

Automated build verification bot for the Prometheus Protocol MCP Server App Store. This bot continuously polls for pending WASM verification requests, runs reproducible Docker builds, and submits attestations or divergence reports to the on-chain registry.

## 🎯 What It Does

1. **Polls** the `mcp_registry` canister for pending verification requests
2. **Checks** if each request has a sponsored `build_reproducibility_v1` bounty
3. **Verifies eligibility** - Skips WASMs where this verifier has already participated
4. **Reserves** the bounty using API key authentication (stakes USDC automatically)
5. **Clones** the developer's repository and checks out the specific commit
6. **Builds** the WASM in a reproducible Docker environment
7. **Compares** the SHA-256 hash of the built WASM against the submitted hash
8. **Submits** an attestation (success) or divergence report (failure)
9. **Waits** for 5-of-9 majority consensus - **payouts are automatic** after consensus

## 🛡️ One Vote Per Verifier

The bot automatically checks if you've already participated in a WASM verification:

- **Before reserving a bounty**, checks all bounties for the WASM
- **Identifies prior participation** by checking bounty locks
- **Skips the job** if you've already submitted an attestation or divergence
- **Prevents duplicate votes** - Each verifier can only vote once per WASM

This ensures the 5-of-9 majority consensus requires **5 unique verifiers**, not the same verifier claiming multiple bounties.

## 🔑 API Key Authentication (New in v2.0)

**No wallet management needed!** The bot uses API keys for authentication:

### Setup Process

1. **Visit the verifier dashboard** at `https://your-app-store.com/verifier`
2. **Deposit USDC stake** (e.g., 50-100 USDC) into your verifier account
3. **Generate an API key** - This creates a credential like `vr_0123456789abcdef...`
4. **Configure the bot** with your API key in the `.env` file

### Benefits

✅ **No private keys** - API keys are safer than exposing wallet credentials
✅ **Easy revocation** - Disable a compromised key instantly from the dashboard
✅ **Multiple bots** - Run several verifier instances with separate API keys
✅ **Automatic staking** - Stakes are managed by the audit hub, not individual bounties
✅ **Simplified deployment** - No identity management or PEM file complexity

## 🔐 Build Reproducibility

**How It Works**: The verifier automatically detects the `moc` version from your project's `mops.toml` file and uses the matching Docker base image.

### Automatic Version Detection

1. **Developer specifies version** in their project's `mops.toml`:

   ```toml
   [toolchain]
   moc = "0.16.0"
   ```

2. **Developer builds locally**:

   ```bash
   docker-compose run --rm wasm
   # Uses: ghcr.io/research-ag/motoko-build:moc-0.16.0
   # Output: 79b15176dc613860f35867828f40e7d6db...
   ```

3. **Developer publishes** to registry with that WASM

4. **Verifier bot clones** the repo and reads `mops.toml`:

   ```typescript
   // Verifier automatically detects: moc = "0.16.0"
   // Uses same Docker image: ghcr.io/research-ag/motoko-build:moc-0.16.0
   ```

5. **Verifier rebuilds** from source:
   ```bash
   docker-compose run --rm wasm
   # Output: 79b15176dc613860f35867828f40e7d6db... ✅ MATCH!
   ```

### Key Benefits

✅ **No manual configuration** - Developers just set their `moc` version in `mops.toml`
✅ **Automatic version matching** - Verifier uses the exact same compiler version
✅ **Supports multiple versions** - Different projects can use different `moc` versions simultaneously
✅ **Future-proof** - New `moc` releases work automatically (as long as Docker image exists)

### Developer Workflow

Developers only need to:

1. Add `[toolchain]` section to `mops.toml`:

   ```toml
   [toolchain]
   moc = "0.16.0"  # Or whatever version they want
   ```

2. Build using Docker (this ensures reproducibility):

   ```bash
   docker-compose run --rm wasm
   ```

3. Publish with app-store-cli:
   ```bash
   npm run app-store -- publish 1.0.0
   ```

**That's it!** The verifier will automatically use the same `moc` version when rebuilding.

### Requirements

- Project must have `mops.toml` with `[toolchain]` section
- Docker base image must exist: `ghcr.io/research-ag/motoko-build:moc-<version>`
- Both developer and verifier use the Docker build process

If developers use native builds (`dfx build` or `./build.sh`), hashes **will not match** and verification will fail.

See the [app-store-cli README](../app-store-cli/README.md) for developer build instructions.

## 🏗️ Architecture Note

The verifier bot is a **simple Node.js process** that spawns Docker containers for each build. It does NOT use Docker-in-Docker (DinD). Instead:

- **The bot runs as a lightweight Node.js service** (uses Docker CLI)
- **Each build runs in its own isolated Docker container** (ensures reproducibility)
- **The bot mounts the host Docker socket** (`/var/run/docker.sock`)

This approach is simpler, more secure, and easier to deploy than DinD while maintaining full build reproducibility.

## 📋 Prerequisites

- **Docker** (for local testing)
- **Node.js 20+** (for development)
- **pnpm** (package manager)
- An **ICP identity** with reputation tokens in the `audit_hub` canister

## 🚀 Quick Start

### 1. Local Development

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Set up environment
export VERIFIER_PEM="$(cat ~/.config/dfx/identity/verifier/identity.pem)"
export IC_NETWORK="local"  # or "ic" for mainnet
export POLL_INTERVAL_MS="60000"

# Run the bot
pnpm start
```

### 2. Testing with Docker

```bash
# Build the Docker image
docker build -t verifier-bot .

# Run with environment variables
docker run --rm \
  -e VERIFIER_PEM="$VERIFIER_PEM" \
  -e IC_NETWORK="ic" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  verifier-bot
```

## 🔧 Configuration

### Environment Variables

| Variable           | Description                         | Default | Required |
| ------------------ | ----------------------------------- | ------- | -------- |
| `VERIFIER_PEM`     | Ed25519 private key in PEM format   | -       | ✅       |
| `IC_NETWORK`       | ICP network (`ic` or `local`)       | `ic`    | ❌       |
| `POLL_INTERVAL_MS` | Milliseconds between polling cycles | `60000` | ❌       |

## 🌐 Deployment Options

### Prerequisites (All Platforms)

#### Step 1: Create Verifier Identity

```bash
# Create a new dfx identity for the verifier
dfx identity new verifier

# Export the private key
dfx identity use verifier
dfx identity export verifier > verifier.pem

# Get the principal (you'll need this for the next step)
dfx identity get-principal
```

**Example output**: `abc12-3def4-5ghi6-jklmn-opqrs-tuvwx-yz789-abcde-fghij-klmno-pqr`

#### Step 2: Mint Reputation Tokens

The verifier needs reputation tokens to stake when reserving bounties. As the `audit_hub` owner:

```bash
dfx canister call audit_hub mint_tokens \
  '(principal "<verifier-principal>", "build_reproducibility_v1", 10_000_000)'
```

This gives the verifier 10 million reputation tokens (enough for many verifications).

---

### Option A: DigitalOcean Droplet (Recommended)

**✅ Full Docker control, simple setup, cost-effective**

#### 1. Create Droplet

- Go to [DigitalOcean](https://digitalocean.com)
- Create new Droplet
- **Image**: Ubuntu 22.04 LTS
- **Plan**: Basic - $6/month (1 vCPU, 1GB RAM is sufficient)
- **Datacenter**: Choose closest to your location
- **Authentication**: SSH key (recommended) or password
- Click **Create Droplet**

#### 2. Install Docker

SSH into your droplet and run:

```bash
ssh root@your-droplet-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt-get update
apt-get install -y docker-compose-plugin git

# Verify installation
docker --version
docker compose version
```

#### 3. Deploy the Bot

```bash
# Clone repository
git clone https://github.com/prometheus-protocol/prometheus-protocol.git
cd prometheus-protocol/packages/apps/verifier-bot

# Create identity file
cat > identity.pem << 'EOF'
<paste your verifier.pem contents here>
EOF
chmod 600 identity.pem

# Create environment file
cat > .env << 'EOF'
IDENTITY_PEM_PATH=./identity.pem
REGISTRY_CANISTER_ID=your-registry-id
AUDIT_HUB_CANISTER_ID=your-audit-hub-id
NETWORK=ic
POLL_INTERVAL_MS=60000
EOF

# Build and start the bot
docker build -t verifier-bot .
docker run -d \
  --name verifier-bot \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/identity.pem:/app/identity.pem:ro \
  --env-file .env \
  verifier-bot
```

#### 4. Monitor

```bash
# View live logs
docker logs -f verifier-bot

# Check status
docker ps

# Restart if needed
docker restart verifier-bot

# Stop
docker stop verifier-bot
```

#### 5. Optional: Use systemd for Auto-Restart

For production reliability, create a systemd service:

```bash
cat > /etc/systemd/system/verifier-bot.service << 'EOF'
[Unit]
Description=Prometheus Protocol Verifier Bot
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/root/prometheus-protocol/packages/apps/verifier-bot
ExecStart=/usr/bin/docker start -a verifier-bot
ExecStop=/usr/bin/docker stop verifier-bot
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable verifier-bot
systemctl start verifier-bot

# View logs
journalctl -u verifier-bot -f
```

#### 6. Updates

```bash
cd /root/prometheus-protocol
git pull origin main
cd packages/apps/verifier-bot
docker build -t verifier-bot .
docker stop verifier-bot
docker rm verifier-bot
docker run -d \
  --name verifier-bot \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/identity.pem:/app/identity.pem:ro \
  --env-file .env \
  verifier-bot
```

**Cost**: ~$6/month for basic droplet

---

### Option B: Render.com

**⚠️ Note**: Render doesn't provide Docker socket access, so this requires using a different build approach or self-hosting.

If you still want to use Render, you'll need to refactor the bot to use native builds instead of Docker. See troubleshooting section below.

---

### Option C: AWS EC2 / GCP Compute Engine

Similar to DigitalOcean but with more configuration. Use the same Docker deployment steps from Option A.

**AWS EC2**:

- Launch t3.micro instance ($10/month)
- Use Amazon Linux 2 or Ubuntu 22.04
- Install Docker via user data script

**GCP Compute Engine**:

- Launch e2-micro instance ($7/month)
- Use Container-Optimized OS (Docker pre-installed)
- Or use Ubuntu 22.04

---

### Deployment Checklist

After deployment, verify:

```
✅ Docker daemon is accessible
✅ Bot container is running (`docker ps`)
✅ Logs show successful polling
✅ No errors in verifier identity/permissions
✅ Reputation token balance is sufficient
```

Expected log output:

```
🤖 Prometheus Protocol Verifier Bot
====================================
🆔 Verifier Principal: abc12-3def4-...
🌐 Network: ic
⏱️  Poll Interval: 60000ms
====================================

🚀 Verifier Bot is starting...
✅ Verifier Bot is now running
   Polling every 60 seconds
```

## 📊 Monitoring

### Key Log Messages

| Log                                           | Meaning                      |
| --------------------------------------------- | ---------------------------- |
| `🔍 Polling for pending verifications...`     | Normal heartbeat             |
| `🎯 Processing verification job`              | Started a new job            |
| `✅ Build verified! Hash matches.`            | Successful verification      |
| `❌ Build verification failed.`               | Hash mismatch or build error |
| `⏭️ Skipping <hash>: No bounty sponsored yet` | Waiting for sponsor          |
| `❌ Error processing <hash>`                  | Exception occurred           |

### Health Checks

The Docker container includes a health check that verifies the Node.js process is running:

```bash
docker ps  # Check if container shows "healthy"
```

### Render Dashboard

Monitor the bot's performance:

1. Go to your service in the Render dashboard
2. Click **Logs** to see real-time output
3. Check **Metrics** for CPU/memory usage

## 🐛 Troubleshooting

### Bot Not Processing Jobs

**Symptoms**: Logs show polling but no jobs processed.

**Possible Causes**:

- No pending verifications with bounties
- Verifier ran out of reputation tokens
- Verifier identity doesn't have permission

**Solution**:

```bash
# Check verifier's reputation balance
dfx canister call audit_hub get_auditor_profile \
  '(principal "<verifier-principal>")'

# If balance is low, mint more tokens
dfx canister call audit_hub mint_tokens \
  '(principal "<verifier-principal>", "build_reproducibility_v1", 10_000_000)'
```

### Build Timeouts

**Symptoms**: `Build failed: timeout` errors in logs.

**Solution**: Increase `BUILD_TIMEOUT_MS` environment variable (default: 600000 = 10 minutes).

### Hash Mismatches (False Positives)

**Symptoms**: Bot reports divergence for builds that should succeed.

**Possible Causes**:

- Developer used different `moc` version
- Developer didn't follow reproducible build process
- Timestamp/environment variables leaked into build

**Solution**: Educate developers to use the reproducible build template (see `libs/icrc118/README.md`).

### Docker-Socket Access Issues

**Symptoms**: `Cannot connect to Docker daemon` errors.

**Cause**: Platform doesn't provide `/var/run/docker.sock` access (e.g., Render.com).

**Solutions**:

1. **Use DigitalOcean/AWS/GCP** (recommended) - Full Docker control
2. **Refactor to native builds** - Install `moc`, `ic-wasm`, `mops-cli` directly in bot container
3. **Use AWS ECS / Cloud Run** - Platforms that support Docker-in-Docker

For native builds approach, you'd need to:

- Remove Docker dependency from `builder.ts`
- Install pinned toolchain versions in the Dockerfile
- Run builds in isolated directories instead of containers
- Accept platform-specific build artifacts (less reproducibility guarantee)

## 🔐 Security Considerations

### Private Key Management

**CRITICAL**: The `VERIFIER_PEM` contains the bot's private key. If compromised, an attacker can:

- Spend the bot's reputation tokens
- Submit false attestations
- Drain bounty rewards

**Best Practices**:

- Store `VERIFIER_PEM` in Render's secret manager (not in code)
- Rotate the key periodically (create new identity, mint tokens, update env var)
- Limit reputation token balance (mint only what's needed)
- Monitor for unexpected activity

### Sandboxing

Each build runs in an isolated Docker container with:

- **No network access** (--network=none)
- **Resource limits** (10 min timeout, memory limits via Docker)
- **Ephemeral filesystem** (container destroyed after build)

This prevents malicious code from:

- Exfiltrating data
- Consuming excessive resources
- Persisting across builds

## 📈 Scaling

### Increasing Throughput

**Current**: 1 job per minute (sequential processing).

**To scale**:

1. Increase `MAX_CONCURRENT_JOBS` (future enhancement)
2. Deploy multiple bot instances with different identities
3. Use a job queue (e.g., Redis) to coordinate work

### Cost Optimization

**CPU**: Most time spent in Docker builds (~5-10 min per build).

**Memory**: Each build needs ~2GB RAM.

**Network**: Minimal (only IC canister calls).

**Recommended Render Plan**: Professional ($25/mo for 2GB RAM worker).

## 🛠️ Development

### Project Structure

```
verifier-bot/
├── src/
│   ├── index.ts       # Main polling loop
│   ├── builder.ts     # Docker build orchestration
│   └── types.ts       # TypeScript interfaces
├── templates/
│   └── reproducible-build/
│       ├── docker-compose.yml
│       ├── Dockerfile
│       ├── Dockerfile.base
│       └── build.sh
├── Dockerfile         # Bot's runtime container
├── package.json
├── tsconfig.json
├── SPEC.md           # Technical specification
└── README.md         # This file
```

### Adding Features

**Example**: Add PicJS test execution.

1. Update `builder.ts`:

   ```typescript
   // After building WASM
   const testResult = await runPicJsTests(canisterPath);
   ```

2. Update attestation metadata:
   ```typescript
   attestationData['picjs_tests_passed'] = testResult.passed;
   ```

### Running Tests

```bash
# Unit tests (future)
pnpm test

# Integration test with local replica
dfx start --background
pnpm build && pnpm start
```

## 📚 Additional Resources

- **Developer Guide**: See [DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md) for how to build WASMs that pass verification
- **Technical Specification**: See [SPEC.md](./SPEC.md) for the complete architecture
- **Reproducible Builds Template**: See [libs/icrc118/README.md](../../libs/icrc118/README.md)
- **ICRC-126 Standard**: [ICRC-126.md](../../libs/icrc118/ICRC126.md)
- **ICRC-127 Bounties**: [ICRC-127.md](../../libs/icrc118/ICRC127.md)

## 🤝 Contributing

This bot is a critical piece of infrastructure for the Prometheus Protocol. Please:

- Test changes thoroughly on local replica before mainnet
- Monitor logs for at least 24 hours after deployment
- Report any anomalies in the Discord #dev channel

## 📝 License

MIT License - See root LICENSE file
