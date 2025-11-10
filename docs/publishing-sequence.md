# Publishing New Version Sequence

This document outlines the streamlined workflow for publishing a new version using the reproducible build system.

## Prerequisites

- Ensure `app-store-cli` is built and available in your PATH
- **Must be using `pp_owner` identity**: Run `dfx identity use pp_owner` before publishing
- Ensure all changes are committed before publishing (the release command will check)

## Quick Start (Recommended)

### One-Command Publishing

From your project directory (e.g., `/tmp/test`):

```bash
app-store-cli release 0.18.0
```

**That's it!** This single command handles the entire workflow automatically.
**That's it!** This single command handles the entire workflow automatically.

### What It Does

The `release` command automatically:

1. ✅ Updates version in `src/main.mo`
2. ✅ Commits and pushes version change (`git commit -m "v0.18.0"`)
3. ✅ Updates `prometheus.yml` with the new commit hash
4. ✅ Commits and pushes prometheus.yml update
5. ✅ Builds WASM with reproducible build system
6. ✅ Publishes to registry and creates verification bounties

### Advanced Options

For more control over the process:

```bash
# Skip git operations (if you want manual control over commits)
app-store-cli release 0.18.0 --skip-git

# Skip building (if you already have a built WASM)
app-store-cli release 0.18.0 --skip-build

# Combine options
app-store-cli release 0.18.0 --skip-git --skip-build

# Publish to mainnet (default is local)
app-store-cli release 1.0.0 --network ic
```

## Alternative: Standalone Script

If you prefer using a shell script instead of the CLI command:

```bash
/home/jesse/prometheus-protocol/prometheus-protocol/scripts/publish-version.sh 0.18.0
```

This script provides similar functionality but runs independently of the CLI.

## Manual Step-by-Step (Advanced)

If you need more control or want to understand each step:

## Manual Step-by-Step (Advanced)

If you need more control or want to understand each step:

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
cd /tmp/test && app-store-cli publish 0.18.0 --network local 2>&1 | tail -20
```

</details>

---

## Next Steps After Publishing

After running `app-store-cli release`, the workflow creates verification bounties. Here's what happens next:

1. **Check Audit Hub UI**: Verify that your bounty was created successfully
   - Visit the Audit Hub page in the app store UI
   - You should see your version listed with 0/9 verifications

2. **Monitor Verifier Bots**: Watch the bots pick up and process the verification

   ```bash
   # View logs from all verifier bots
   cd packages/apps/verifier-bot/deployment
   docker-compose logs -f
   ```

3. **Wait for Consensus**: The system requires 9/9 verifier participation
   - 5/9 majority needed for finalization (consensus)
   - All 9 verifiers must participate before payouts
   - Typically takes 1-5 minutes per verification

4. **Verification Complete**: Once consensus is reached, bounties are paid automatically
   - Winning verifiers receive $0.25 USDC each
   - Attestations and divergences are recorded on-chain
   - Your version is now verified and published!

This registers the version and creates verification bounties.

## Important Notes

- **Use the `release` command**: It's the recommended and easiest way to publish
- **GITHUB_TOKEN is handled automatically**: The build system loads it from your environment
- **The version must match**: Don't manually edit `src/main.mo` - let the command do it
- **Commit hash is auto-updated**: The command ensures `prometheus.yml` always has the correct hash
- **Safety checks built-in**: The command validates your git state before starting
- **After updating GITHUB_TOKEN in .env**, recreate the verifier bots:

  ```bash
  cd packages/apps/verifier-bot/deployment && docker-compose up -d
  ```

  - ⚠️ **IMPORTANT**: Use `docker-compose up -d`, NOT `docker-compose restart`. The `restart` command does NOT reload environment variables from .env!

## Troubleshooting

### Command fails with "Not in a git repository"

Make sure you're running the command from your project directory (e.g., `/tmp/test`), not from the prometheus-protocol repo.

### Command fails with "uncommitted changes"

The release command requires a clean working directory. Commit or stash your changes:

```bash
git add .
git commit -m "my changes"
# or
git stash
```

### Build fails with mops rate limiting

Ensure GITHUB_TOKEN is set in your environment. The CLI will use it automatically during the build.

### Verification fails

- Check that `prometheus.yml` git_commit matches your actual commit hash (the release command handles this)
- Ensure you're building from the exact commit hash specified
- Verify GITHUB_TOKEN is working (test by cloning a private repo)

### Network errors

If publishing to mainnet (`--network ic`), ensure you have ICP in your pp_owner identity for cycles.

## Quick Examples

### Publishing v0.18.0 (Automated)

## Quick Examples

### Publishing v0.18.0 (Automated - CLI)

```bash
cd /tmp/test
app-store-cli release 0.18.0 --network local
```

### Publishing v0.18.0 (Automated - Script)

```bash
cd /tmp/test
/home/jesse/prometheus-protocol/prometheus-protocol/scripts/publish-version.sh 0.18.0
```

## Quick Examples

### Simple Release

```bash
cd /tmp/test
app-store-cli release 0.18.0
```

### Release to Mainnet

```bash
cd /tmp/test
app-store-cli release 1.0.0 --network ic
```

### Release with Manual Git Control

```bash
# If you want to handle git commits yourself
cd /tmp/test
app-store-cli release 0.18.0 --skip-git
```

### Release with Pre-built WASM

```bash
# If you already ran 'app-store-cli build'
cd /tmp/test
app-store-cli release 0.18.0 --skip-build
```

---

## Manual Step-by-Step (Advanced Users Only)

<details>
<summary>Click to expand manual workflow (not recommended)</summary>

If you need complete manual control over each step:
