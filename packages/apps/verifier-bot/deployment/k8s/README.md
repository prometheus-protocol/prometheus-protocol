# Kubernetes Deployment for Verifier Bots

This directory contains Kubernetes manifests for deploying Prometheus Protocol verifier bots.

## Publishing Container Image

Before deploying to production, you need to build and publish the verifier-bot container to GitHub Container Registry (GHCR):

```bash
# From the verifier-bot directory
cd packages/apps/verifier-bot

# Set your GitHub token with write:packages permission
export GHCR_TOKEN=ghp_your_token_with_packages_permission

# Build and publish (requires GHCR_TOKEN in environment)
./publish-container.sh v1.0.0

# Or using npm/pnpm
pnpm docker:publish v1.0.0
```

The script will:

1. Build the TypeScript code
2. Build the Docker image
3. Tag it for GHCR
4. Push to `ghcr.io/prometheus-protocol/verifier-bot:latest` and `ghcr.io/prometheus-protocol/verifier-bot:[version]`

**Note:** You need a GitHub Personal Access Token with `write:packages` permission. Set it as `GHCR_TOKEN` in your environment.

**Important:** `GHCR_TOKEN` is different from `GITHUB_TOKEN` (used by verifier bots to download dependencies).

## Files

### Local Development (kind cluster)

- `configmap.yaml` - Configuration for local dfx replica
- `canister-ids-configmap.yaml` - Local canister IDs from `.dfx/local/canister_ids.json`
- `deployments.yaml` - Deployments using local Docker image (`verifier-bot:latest`)
- `secrets.yaml` - API keys for verifiers (**not committed to git**, create from template)
- `secrets.yaml.template` - Template for creating secrets.yaml

### Production

- `configmap-prod.yaml` - Configuration for IC mainnet
- `canister-ids-configmap-prod.yaml` - Production canister IDs
- `deployments-prod.yaml` - Deployments using ghcr.io image
- `secrets-prod.yaml` - Production API keys (**not committed to git**, create from template)
- `secrets.yaml.template` - Template for creating secrets files

## Local Deployment (kind cluster)

1. **Create secrets.yaml from template:**

   ```bash
   cp secrets.yaml.template secrets.yaml
   # Edit secrets.yaml and replace placeholder values with your actual API keys
   ```

2. **Create kind cluster:**

   ```bash
   kind create cluster --name verifier-bots --config kind-config.yaml
   ```

3. **Load local Docker image:**

   ```bash
   docker build -t verifier-bot:latest ..
   kind load docker-image verifier-bot:latest --name verifier-bots
   ```

4. **Apply manifests:**

   ```bash
   kubectl create namespace prometheus-verifiers
   kubectl apply -f secrets.yaml
   kubectl apply -f configmap.yaml
   kubectl apply -f canister-ids-configmap.yaml
   kubectl apply -f deployments.yaml
   ```

5. **Verify deployment:**
   ```bash
   kubectl get pods -n prometheus-verifiers
   kubectl logs -n prometheus-verifiers verifier-bot-1-<pod-id>
   ```

## Production Deployment

1. **Create secrets-prod.yaml from template (if not already created):**

   ```bash
   cp secrets.yaml.template secrets-prod.yaml
   # Edit secrets-prod.yaml and replace placeholder values with your actual API keys
   ```

2. **Create namespace:**

   ```bash
   kubectl create namespace prometheus-verifiers
   ```

3. **Apply production manifests:**

   ```bash
   kubectl apply -f secrets-prod.yaml
   kubectl apply -f configmap-prod.yaml
   kubectl apply -f canister-ids-configmap-prod.yaml
   kubectl apply -f deployments-prod.yaml
   ```

4. **Verify deployment:**
   ```bash
   kubectl get pods -n prometheus-verifiers
   kubectl logs -n prometheus-verifiers verifier-bot-1-<pod-id>
   ```

## Configuration

### Environment Variables (configmap.yaml / configmap-prod.yaml)

- `IC_NETWORK`: `local` for development, `ic` for production
- `IC_HOST`: `http://host.docker.internal:4943` for local, `https://ic0.app` for production
- `POLL_INTERVAL_MS`: How often to poll for new verifications (default: 60000ms)
- `BUILD_TIMEOUT_MS`: Maximum time for a build (default: 600000ms)

### Secrets (secrets.yaml)

- `verifier-1-api-key` through `verifier-10-api-key`: API keys for each verifier
- These are generated via the MCP Registry canister

### Canister IDs

Local and production use different ConfigMaps to provide the appropriate canister IDs:

- Local: `.dfx/local/canister_ids.json` format
- Production: Root `canister_ids.json` with `"ic"` network

## Scaling

To run fewer than 10 verifiers:

```bash
kubectl delete deployment verifier-bot-10 -n prometheus-verifiers
kubectl delete deployment verifier-bot-9 -n prometheus-verifiers
# etc.
```

To add more verifiers:

1. Add API key to `secrets.yaml`
2. Copy a deployment section in `deployments.yaml` / `deployments-prod.yaml`
3. Update the deployment name and API key reference
4. Apply the changes

## Monitoring

View logs from all bots:

```bash
kubectl logs -n prometheus-verifiers -l app=verifier-bot --tail=50
```

View logs from a specific bot:

```bash
kubectl logs -n prometheus-verifiers verifier-bot-1-<pod-id> -f
```

Check pod status:

```bash
kubectl get pods -n prometheus-verifiers
kubectl describe pod -n prometheus-verifiers verifier-bot-1-<pod-id>
```

## Troubleshooting

### Pods stuck in ImagePullBackOff

For local development, ensure the image is loaded into kind:

```bash
kind load docker-image verifier-bot:latest --name verifier-bots
```

For production, ensure the image is published to ghcr.io and the cluster has pull permissions.

### Bots can't find canister IDs

Check that the ConfigMap is mounted:

```bash
kubectl exec -n prometheus-verifiers verifier-bot-1-<pod-id> -- ls -la /.dfx/local/
kubectl exec -n prometheus-verifiers verifier-bot-1-<pod-id> -- cat /.dfx/local/canister_ids.json
```

### Bots can't connect to IC

- **Local**: Ensure dfx is running and accessible at `host.docker.internal:4943`
- **Production**: Check that `IC_HOST` is set to `https://ic0.app` in configmap-prod.yaml
