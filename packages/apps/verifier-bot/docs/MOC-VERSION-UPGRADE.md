# How to Update moc Version

This guide explains how to update the Motoko compiler (`moc`) version used by the verifier bot and developers.

## Why Version Management Matters

The verifier bot and developers **must use the exact same `moc` version** to produce matching WASM hashes. Different `moc` versions produce different bytecode, causing verification to fail.

**Current Issue**: 
- `create-motoko-mcp-server` uses `moc 0.16.0`
- Verifier bot templates use `moc 0.14.9`
- This mismatch will cause all verifications to fail! ❌

## Quick Fix: Update to moc 0.16.0

### Step 1: Check if Base Image Exists

Check if `ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0` exists:

```bash
docker pull ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0
```

**If it exists**: Great! Proceed to Step 2.

**If it doesn't exist**: You have two options:
1. **Wait for upstream** (research-ag/motoko-build) to publish it
2. **Build your own base image** (see "Custom Base Image" section below)

### Step 2: Update Verifier Bot Templates

Update all version references in the verifier bot templates:

**File: `packages/apps/verifier-bot/templates/reproducible-build/docker-compose.yml`**

```yaml
x-base-image:
  versions:
    dfx: &dfx 0.16.0  # Match moc version
    moc: &moc 0.16.0  # ← UPDATE THIS
    ic-wasm: &ic_wasm 0.9.3  # Check if newer version needed
    mops-cli: &mops-cli 0.2.0
  name: &base_name 'ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0'  # ← UPDATE THIS
```

### Step 3: Update Verifier Bot Source Code

**File: `packages/apps/verifier-bot/src/builder.ts`**

Find and update all hardcoded version strings:

```typescript
// Around line 201
const toolchainVersions = {
  base: '0.16.0',  // ← UPDATE THIS
  'ic-wasm': '0.9.3',
  'mops-cli': '0.2.0',
};

// Around line 213
const mocVersion = pkg.toolchain?.moc 
  ? String(pkg.toolchain.moc)
  : '0.16.0';  // ← UPDATE THIS (fallback)
```

Also update the mops.toml template generation:

```typescript
// Around line 234
const mopsTomlContent = `
[toolchain]
moc = "0.16.0"  # ← UPDATE THIS
`;
```

### Step 4: Update Documentation

**File: `packages/apps/verifier-bot/README.md`**

Search for "0.14.9" and update all references:

```markdown
- Uses the base Docker image: `ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0`
- Runs with pinned toolchain versions: `moc 0.16.0`, `ic-wasm 0.9.3`, `mops-cli 0.2.0`
```

**File: `packages/apps/verifier-bot/SPEC.md`**

Update the toolchain section:

```markdown
- `moc` 0.16.0 (Motoko compiler)
```

**File: `packages/apps/verifier-bot/DEVELOPER-GUIDE.md`**

Update all examples showing the pinned versions.

**File: `packages/apps/app-store-cli/README.md`**

Update the "Why Docker?" section.

### Step 5: Update create-motoko-mcp-server Template

Make sure the template project includes the reproducible build files with `moc 0.16.0`:

```bash
# In your create-motoko-mcp-server template
cp packages/apps/verifier-bot/templates/reproducible-build/* template/
```

### Step 6: Rebuild and Test

```bash
# Rebuild verifier bot
cd packages/apps/verifier-bot
pnpm build

# Test with a sample project
cd /tmp
git clone <test-project>
cd test-project
docker-compose run --rm wasm
# Note the hash

# Simulate verifier
cd /tmp/verify-test
git clone <test-project>
docker-compose run --rm wasm
# Hash should match!
```

### Step 7: Deploy Updated Verifier

```bash
# On your DigitalOcean droplet
ssh root@your-droplet

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

---

## Custom Base Image (If upstream doesn't have moc 0.16.0)

If `ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0` doesn't exist, you need to build and host your own.

### Option A: Build Locally and Use docker-compose build

**File: `templates/reproducible-build/Dockerfile.base`**

Update the base image to install `moc 0.16.0`:

```dockerfile
FROM ubuntu:22.04

ARG MOC_VERSION=0.16.0
ARG DFX_VERSION=0.16.0
ARG IC_WASM_VERSION=0.9.3
ARG MOPS_CLI_VERSION=0.2.0

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install moc
RUN curl -fsSL https://github.com/dfinity/motoko/releases/download/${MOC_VERSION}/motoko-Linux-x86_64-${MOC_VERSION}.tar.gz \
    | tar -xzC /usr/local/bin

# Install ic-wasm
RUN curl -fsSL https://github.com/dfinity/ic-wasm/releases/download/${IC_WASM_VERSION}/ic-wasm-linux64 \
    -o /usr/local/bin/ic-wasm \
    && chmod +x /usr/local/bin/ic-wasm

# Install mops-cli
RUN curl -fsSL https://cli.mops.one/install.sh | bash

WORKDIR /project
```

**Update docker-compose.yml** to build locally:

```yaml
x-base-image:
  versions:
    dfx: &dfx 0.16.0
    moc: &moc 0.16.0
    ic-wasm: &ic_wasm 0.9.3
    mops-cli: &mops-cli 0.2.0
  name: &base_name 'local/motoko-build:moc-0.16.0'  # ← Local image

services:
  base:
    build:
      context: .
      dockerfile: Dockerfile.base
      args:
        MOC_VERSION: *moc
        DFX_VERSION: *dfx
        IC_WASM_VERSION: *ic_wasm
        MOPS_CLI_VERSION: *mops-cli
    image: *base_name
  wasm:
    build:
      context: .
      args:
        IMAGE: *base_name
    volumes:
      - ./out:/project/out
    environment:
      compress: no
    command: bash --login build.sh
```

Then everyone (developers + verifier bot) must build the base image first:

```bash
docker-compose build base
docker-compose run --rm wasm
```

### Option B: Host Your Own Base Image

Build and push to your own registry:

```bash
# Build the base image
cd packages/apps/verifier-bot/templates/reproducible-build
docker build -f Dockerfile.base \
  --build-arg MOC_VERSION=0.16.0 \
  --build-arg DFX_VERSION=0.16.0 \
  --build-arg IC_WASM_VERSION=0.9.3 \
  --build-arg MOPS_CLI_VERSION=0.2.0 \
  -t ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0 .

# Push to GitHub Container Registry
docker push ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0
```

Update docker-compose.yml to use your registry:

```yaml
name: &base_name 'ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0'
```

### Option C: Wait for Upstream

Contact the maintainers of `research-ag/motoko-build` and request they publish `moc-0.16.0`:

- GitHub: https://github.com/research-ag/motoko-build-template
- Open an issue requesting the new version

---

## Version Compatibility Matrix

| moc Version | ic-wasm Version | Base Image Available? | Notes |
|-------------|-----------------|----------------------|-------|
| 0.13.x      | 0.9.0 - 0.9.3   | ✅ Yes               | Legacy |
| 0.14.x      | 0.9.3           | ✅ Yes               | Stable |
| 0.15.x      | 0.9.3           | ❓ Unknown           | Check upstream |
| 0.16.0      | 0.9.3+          | ❓ Unknown           | **Your current need** |

---

## Migration Strategy for Existing Projects

If you already have developers using `moc 0.14.9` and want to migrate to `0.16.0`:

### 1. Communicate the Breaking Change

```
⚠️ BREAKING CHANGE: moc version update

We are upgrading from moc 0.14.9 → 0.16.0.

All developers must:
1. Update docker-compose.yml in their projects
2. Rebuild with: docker-compose build base
3. Rebuild their WASM: docker-compose run --rm wasm
4. Resubmit to registry with new hash

Old WASMs built with 0.14.9 will fail verification after this update.
```

### 2. Coordinate Deployment

1. **Update verifier bot first** (but don't deploy yet)
2. **Notify all developers** to update their projects
3. **Wait for developers** to rebuild and resubmit
4. **Deploy updated verifier bot**
5. **Verify the new submissions** pass

### 3. Version Registry (Future Enhancement)

Consider adding a version field to the registry:

```typescript
type WasmMetadata = {
  hash: Uint8Array;
  toolchain_version: {
    moc: string;
    ic_wasm: string;
  };
  // ...
};
```

This allows the verifier to use the correct toolchain for each submission.

---

## Automated Version Sync (Recommended)

To prevent version drift, create a single source of truth:

**File: `packages/apps/verifier-bot/toolchain.json`**

```json
{
  "moc": "0.16.0",
  "dfx": "0.16.0",
  "ic_wasm": "0.9.3",
  "mops_cli": "0.2.0",
  "base_image": "ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0"
}
```

Then update:
- `builder.ts` to read from this file
- `docker-compose.yml` to use env vars
- CI/CD to validate consistency

**Example builder.ts update:**

```typescript
import toolchainConfig from '../toolchain.json';

const toolchainVersions = {
  base: toolchainConfig.moc,
  'ic-wasm': toolchainConfig.ic_wasm,
  'mops-cli': toolchainConfig.mops_cli,
};
```

---

## Testing Checklist

Before deploying a new `moc` version:

- [ ] Base Docker image exists or is built
- [ ] `docker-compose.yml` updated with new version
- [ ] `builder.ts` updated with new version
- [ ] All documentation updated
- [ ] Test project builds successfully with new version
- [ ] Verifier bot can rebuild and hash matches
- [ ] CI/CD pipelines updated (if any)
- [ ] Developers notified of breaking change
- [ ] Rollback plan prepared

---

## Rollback Procedure

If something goes wrong after deploying new version:

```bash
# On the verifier droplet
ssh root@your-droplet
cd /root/prometheus-protocol

# Rollback to previous commit
git log --oneline  # Find previous version commit
git checkout <previous-commit-hash>

# Rebuild and restart
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

# Notify developers to revert
```

---

## Summary

**Immediate Action Required**:

1. Verify if `ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0` exists
2. If yes: Update all references from `0.14.9` → `0.16.0`
3. If no: Build custom base image or wait for upstream
4. Coordinate with developers for synchronized migration
5. Test thoroughly before mainnet deployment

**Files to Update**:
- `packages/apps/verifier-bot/templates/reproducible-build/docker-compose.yml`
- `packages/apps/verifier-bot/src/builder.ts`
- `packages/apps/verifier-bot/README.md`
- `packages/apps/verifier-bot/SPEC.md`
- `packages/apps/verifier-bot/DEVELOPER-GUIDE.md`
- `packages/apps/app-store-cli/README.md`

**Version Consistency is Critical**: One mismatch = 100% verification failure rate! ⚠️
