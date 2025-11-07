# Developer Guide: Reproducible Builds for Verification

This guide explains how to build your Motoko canister so it can pass automated verification.

## Why Reproducible Builds?

When you submit a WASM to the Prometheus Protocol registry, the verifier bot:

1. Clones your repository at the specified commit
2. **Reads your `mops.toml` to detect the `moc` version** you used
3. Rebuilds your code from source using the **same `moc` version** in a Docker container
4. Compares the SHA-256 hash of the rebuilt WASM with your submitted WASM

If the hashes don't match, verification fails. This protects users by proving that the deployed code matches the public source code.

**Key Advantage**: You control the `moc` version in your project's `mops.toml`, and the verifier automatically uses the same version. No manual coordination needed!

## Quick Start

### 1. Add Docker Build Files to Your Project

Your project needs these files in the root directory:

```
your-project/
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.base
├── build.sh
├── src/
│   └── main.mo
├── did/
│   └── service.did
├── mops.toml
└── prometheus.yml
```

**Copy the reproducible build templates** from the verifier-bot:

```bash
# From your project root
cp -r path/to/prometheus-protocol/packages/apps/verifier-bot/templates/reproducible-build/* .
```

Or download them from: [libs/icrc118](https://github.com/prometheus-protocol/prometheus-protocol/tree/main/libs/icrc118)

### 2. Specify Your moc Version

**Edit `mops.toml`** to include the `[toolchain]` section:

```toml
[package]
name = "my-mcp-server"
version = "1.0.0"

[dependencies]
base = "0.11.1"
# ... other dependencies

[toolchain]
moc = "0.16.0"  # ← Specify your desired moc version
```

**Important**: The verifier will automatically use this version when rebuilding your code!

### 3. Build Your WASM Reproducibly

**Always use Docker to build:**

```bash
docker-compose run --rm wasm
```

This command:

- Reads your `moc` version from `mops.toml` (e.g., `0.16.0`)
- Pulls the matching base image: `ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0`
- Builds your canister in an isolated Linux environment
- Outputs the WASM to `out/out_Linux_x86_64.wasm`
- Prints the SHA-256 hash

**Example output:**

```
79b15176dc613860f35867828f40e7d6db884c25a5cfd0004f49c3b4b0b3fd5c  out/out_Linux_x86_64.wasm
```

### 4. Configure Your Manifest

Edit `prometheus.yml` to point to the reproducible build output:

```yaml
namespace: my-mcp-server
submission:
  repo_url: https://github.com/yourname/your-mcp-server
  wasm_path: ./out/out_Linux_x86_64.wasm # ← IMPORTANT: Must be Docker output
  git_commit: abc123... # Current commit hash
  name: My MCP Server
  description: A secure Model Context Protocol server
```

**Note**: The verifier will read the `moc` version from your `mops.toml`, so you don't need to specify it here!

### 4. Publish

```bash
npm run app-store -- publish 1.0.0
```

The CLI will:

1. Read your WASM from `out/out_Linux_x86_64.wasm`
2. Compute the SHA-256 hash
3. Submit the hash + metadata to the registry
4. Wait for verifier bot to rebuild and attest

**The verifier will automatically use the `moc` version from your `mops.toml`!**

## Common Mistakes

### ❌ Using `dfx build`

```bash
dfx build  # DON'T DO THIS FOR PRODUCTION
npm run app-store -- publish 1.0.0
```

**Problem**: `dfx build` uses whatever `moc` version you have installed locally. The verifier bot uses `moc 0.14.9` in Docker. Different compiler versions produce different WASM bytecode.

**Result**: Hash mismatch → verification fails

### ❌ Building Natively

```bash
./build.sh  # DON'T DO THIS (unless you're on Linux with exact toolchain versions)
npm run app-store -- publish 1.0.0
```

**Problem**: Native builds depend on your host OS and installed tool versions. Even on Linux, subtle differences in `glibc`, kernel version, or filesystem can affect builds.

**Result**: Hash mismatch → verification fails

### ❌ Wrong WASM Path in Manifest

```yaml
wasm_path: .dfx/local/canisters/my_canister/my_canister.wasm # ❌ Wrong!
```

**Problem**: This points to a `dfx build` output, not the reproducible Docker build.

**Fix**:

```yaml
wasm_path: ./out/out_Linux_x86_64.wasm # ✅ Correct!
```

## Platform-Specific Notes

### macOS Users

Docker Desktop for Mac works perfectly. The Docker build runs in a Linux VM, ensuring consistency:

```bash
# You run this on macOS
docker-compose run --rm wasm

# Docker runs this in Linux x86_64
# Output: out/out_Linux_x86_64.wasm with hash abc123...
```

The verifier bot (running on Linux) will produce the **exact same hash**.

### Windows Users

Use Docker Desktop for Windows (WSL2 backend recommended):

```bash
# PowerShell or WSL terminal
docker-compose run --rm wasm
```

### Linux Users

Docker runs natively. Same hash as everyone else:

```bash
docker-compose run --rm wasm
```

## Verifying Locally

You can verify your build will pass before submitting:

```bash
# 1. Build reproducibly
docker-compose run --rm wasm

# 2. Note the hash from output
# Example: 79b15176dc613860f35867828f40e7d6db884c25a5cfd0004f49c3b4b0b3fd5c

# 3. Commit your code
git add .
git commit -m "feat: add new feature"
git push

# 4. Clone fresh copy and rebuild (simulates what verifier does)
cd /tmp
git clone https://github.com/yourname/your-project.git verify-test
cd verify-test
docker-compose run --rm wasm

# 5. Compare hashes - they should match!
```

## Advanced: Custom Toolchain Versions

If you need a different `moc` version, edit `docker-compose.yml`:

```yaml
x-base-image:
  versions:
    moc: &moc 0.14.9 # Change this
    ic-wasm: &ic_wasm 0.9.3
    mops-cli: &mops-cli 0.2.0
  name: &base_name 'ghcr.io/prometheus-protocol/motoko-build-template:moc-0.14.9' # And this
```

**⚠️ Warning**: Custom versions require the verifier bot to support them. Stick with the default unless you have a specific reason.

## Troubleshooting

### Build Fails in Docker

**Symptoms**: `docker-compose run --rm wasm` exits with errors.

**Common Causes**:

- Missing `mops.toml` or invalid dependencies
- Syntax errors in Motoko code
- Missing `did/service.did` file

**Fix**: Test your code with `dfx build` first to catch basic errors, then switch to Docker for the final reproducible build.

### Hash Mismatch After Verification

**Symptoms**: Verifier bot reports divergence even though you built with Docker.

**Common Causes**:

1. **Wrong commit**: Your `prometheus.yml` points to commit `abc123`, but you built from commit `def456`
2. **Uncommitted changes**: You had local modifications when you built
3. **Timestamp/environment leaks**: Your build script embeds the current time or hostname

**Fix**:

```bash
# Ensure clean state
git status  # Should show "nothing to commit, working tree clean"
git rev-parse HEAD  # Copy this exact hash to prometheus.yml

# Build
docker-compose run --rm wasm

# Verify git_commit in prometheus.yml matches current HEAD
```

### Docker Image Pull Fails

**Symptoms**: `failed to pull image ghcr.io/prometheus-protocol/motoko-build-template:moc-0.14.9`

**Fix**: GitHub Container Registry may have rate limits. Try:

```bash
docker pull ghcr.io/prometheus-protocol/motoko-build-template:moc-0.14.9

# If it persists, build the base image locally
docker-compose build base
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build WASM reproducibly
        run: docker-compose run --rm wasm

      - name: Publish to registry
        env:
          VERIFIER_PEM: ${{ secrets.DFX_IDENTITY_PEM }}
        run: |
          npm install
          npm run app-store -- publish ${{ github.ref_name }}
```

### GitLab CI Example

```yaml
build-and-publish:
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker-compose run --rm wasm
    - npm install
    - npm run app-store -- publish $CI_COMMIT_TAG
  only:
    - tags
```

## Resources

- **Reproducible Build Template**: [libs/icrc118](https://github.com/prometheus-protocol/prometheus-protocol/tree/main/libs/icrc118)
- **Verifier Bot Docs**: [packages/apps/verifier-bot](https://github.com/prometheus-protocol/prometheus-protocol/tree/main/packages/apps/verifier-bot)
- **App Store CLI**: [packages/apps/app-store-cli](https://github.com/prometheus-protocol/prometheus-protocol/tree/main/packages/apps/app-store-cli)
- **ICRC-126 Standard**: Attestation specification
- **ICRC-127 Standard**: Bounty/verification specification

## Support

If you're having trouble getting reproducible builds working:

1. Check the [troubleshooting section](#troubleshooting) above
2. Join the Discord: [discord.gg/prometheus-protocol](https://discord.gg/prometheus-protocol)
3. Open an issue: [GitHub Issues](https://github.com/prometheus-protocol/prometheus-protocol/issues)

## Summary Checklist

Before publishing:

- [ ] Copied Docker build files to project root
- [ ] Ran `docker-compose run --rm wasm` successfully
- [ ] WASM output is at `out/out_Linux_x86_64.wasm`
- [ ] Noted the SHA-256 hash from build output
- [ ] Committed all changes (`git status` is clean)
- [ ] `prometheus.yml` has correct `git_commit` (matches `git rev-parse HEAD`)
- [ ] `prometheus.yml` has correct `wasm_path` (`./out/out_Linux_x86_64.wasm`)
- [ ] Ready to run `npm run app-store -- publish <version>`

✅ If all checked, your build will pass automated verification!
