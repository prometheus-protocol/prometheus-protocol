# Publishing New Version Sequence

This document outlines the correct sequence for publishing a new version of the test MCP server.

## Prerequisites

- Ensure `app-store-cli` has been built with GITHUB_TOKEN support in `build.command.ts`
- Have GITHUB_TOKEN available in verifier-bot deployment `.env` file
- **Must be using `pp_owner` identity**: Run `dfx identity use pp_owner` before publishing

## Step-by-Step Sequence

### 1. Update Version in Source Code

```bash
cd /tmp/test && sed -i 's/version = "0.X.0"/version = "0.Y.0"/' src/main.mo
```

Replace `0.X.0` with current version and `0.Y.0` with new version.

### 2. Commit and Push to GitHub

```bash
cd /tmp/test && git add src/main.mo && git commit -m "v0.Y.0" && git push && git rev-parse HEAD
```

This pushes the version change and returns the commit hash.

### 3. Update prometheus.yml with Commit Hash

```bash
cd /tmp/test && sed -i 's/git_commit: .*/git_commit: <COMMIT_HASH>/' prometheus.yml && git add prometheus.yml && git commit -m "Update git_commit hash" && git push
```

Replace `<COMMIT_HASH>` with the hash from step 2. This also commits and pushes the updated prometheus.yml file.

### 4. Build the WASM with GITHUB_TOKEN

```bash
cd /tmp/test && \
export GITHUB_TOKEN=$(grep GITHUB_TOKEN /home/jesse/prometheus-protocol/prometheus-protocol/packages/apps/verifier-bot/deployment/.env | cut -d'=' -f2) && \
app-store-cli build 2>&1 | tail -10
```

This builds the WASM file and extracts the hash from the build output.

### 5. Publish to Registry

```bash
cd /tmp/test && app-store-cli publish 0.Y.0 --network local 2>&1 | tail -20
```

This registers the version and creates verification bounties.

## Important Notes

- **Always use `app-store-cli build` instead of manual docker-compose**: The CLI handles GITHUB_TOKEN properly
- **The version must match** between `src/main.mo` and the publish command
- **Commit hash in prometheus.yml** must match the actual git commit
- **GITHUB_TOKEN is required** to avoid mops rate limiting during builds
- **After updating GITHUB_TOKEN in .env**, recreate the verifier bots: `cd packages/apps/verifier-bot/deployment && docker-compose up -d`
  - ⚠️ **IMPORTANT**: Use `docker-compose up -d`, NOT `docker-compose restart`. The `restart` command does NOT reload environment variables from .env!
- **If publish fails with "already registered"**, the WASM was partially uploaded. You may need to retry or check the registry state.

## Example: Publishing v0.12.0

```bash
# 1. Update version
cd /tmp/test && sed -i 's/version = "0.11.0"/version = "0.12.0"/' src/main.mo

# 2. Commit and get hash
cd /tmp/test && git add src/main.mo && git commit -m "v0.12.0" && git push && git rev-parse HEAD
# Output: abc123def456... (example hash)

# 3. Update prometheus.yml
cd /tmp/test && sed -i 's/git_commit: .*/git_commit: abc123def456.../' prometheus.yml && git add prometheus.yml && git commit -m "Update git_commit hash" && git push

# 4. Build WASM
cd /tmp/test && \
export GITHUB_TOKEN=$(grep GITHUB_TOKEN /home/jesse/prometheus-protocol/prometheus-protocol/packages/apps/verifier-bot/deployment/.env | cut -d'=' -f2) && \
app-store-cli build 2>&1 | tail -10

# 5. Publish
cd /tmp/test && app-store-cli publish 0.12.0 --network local 2>&1 | tail -20
```

### Example All In One Script

NOTE: This version is just an example. Search for the correct version numbers before running.

```bash
cd /tmp/test && sed -i 's/version = "0.17.0"/version = "0.18.0"/' src/main.mo && git add src/main.mo && git commit -m "v0.18.0" && git push && sed -i 's/git_commit: .*/git_commit: '$(git rev-parse HEAD)'/' prometheus.yml && git add prometheus.yml && git commit -m "Update git_commit hash" && git push && export GITHUB_TOKEN=$(grep GITHUB_TOKEN /home/jesse/prometheus-protocol/prometheus-protocol/packages/apps/verifier-bot/deployment/.env | cut -d'=' -f2) && app-store-cli build 2>&1 | tail -3 && app-store-cli publish 0.18.0 --network local 2>&1 | tail -5
```
