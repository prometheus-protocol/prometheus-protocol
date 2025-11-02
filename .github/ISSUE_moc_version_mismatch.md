# Critical: moc Version Mismatch Between Verifier Bot and Developer Templates

## Problem Summary

The verifier bot and create-motoko-mcp-server template use **different `moc` versions**, causing 100% verification failure rate.

- **create-motoko-mcp-server**: Uses `moc 0.16.0`
- **verifier-bot templates**: Uses `moc 0.14.9` (which doesn't even exist in upstream registry!)
- **Upstream available**: Only up to `moc 0.14.3`

## Impact

🔴 **CRITICAL**: All verification requests will fail because:

1. Developers build with `moc 0.16.0` → produces hash `ABC123`
2. Verifier rebuilds with `moc 0.14.9` → produces hash `DEF456`
3. Hashes don't match → attestation fails → no apps can be published

## Root Cause

Different `moc` compiler versions produce different WASM bytecode. Even minor version differences change the hash.

## Current State

### Verifier Bot Templates

Location: `packages/apps/verifier-bot/templates/reproducible-build/docker-compose.yml`

```yaml
x-base-image:
  versions:
    moc: &moc 0.14.9 # ❌ Base image doesn't exist
```

### Developer Template (create-motoko-mcp-server)

Expected to use: `moc 0.16.0`

### Upstream Registry

Available images at `ghcr.io/research-ag/motoko-build`:

- ✅ `moc-0.14.3` (latest available)
- ❌ `moc-0.14.9` (doesn't exist)
- ❌ `moc-0.16.0` (doesn't exist)

Source: https://github.com/research-ag/motoko-build-template

## Solution Options

### Option 1: Downgrade to 0.14.3 (Quick Fix)

**Pros**: Works immediately, uses existing upstream image
**Cons**: Using older compiler version

**Steps**:

1. Update verifier templates: `0.14.9` → `0.14.3`
2. Update create-motoko-mcp-server: `0.16.0` → `0.14.3`
3. Ensure all examples/docs reference `0.14.3`

**Files to update**:

- `packages/apps/verifier-bot/templates/reproducible-build/docker-compose.yml`
- `packages/apps/verifier-bot/src/builder.ts` (lines 201, 213, 234)
- `packages/apps/verifier-bot/README.md`
- `packages/apps/verifier-bot/SPEC.md`
- `packages/apps/verifier-bot/DEVELOPER-GUIDE.md`
- `packages/apps/app-store-cli/README.md`
- All create-motoko-mcp-server templates

### Option 2: Build Custom Base Image for 0.16.0 (Recommended)

**Pros**: Use latest compiler, own the infrastructure
**Cons**: Need to maintain custom Docker image

**Steps**:

1. Create `Dockerfile.base` for `moc 0.16.0`
2. Build and push to `ghcr.io/prometheus-protocol/motoko-build:moc-0.16.0`
3. Update all templates to use custom registry
4. Document for developers

**Implementation**:

```bash
cd packages/apps/verifier-bot/templates/reproducible-build

# Build base image
docker build -f Dockerfile.base \
  --build-arg MOC_VERSION=0.16.0 \
  --build-arg DFX_VERSION=0.16.0 \
  --build-arg IC_WASM_VERSION=0.9.3 \
  --build-arg MOPS_CLI_VERSION=0.2.0 \
  -t ghcr.io/prometheus-protocol/motoko-build:moc-0.16.0 .

# Push to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u prometheus-protocol --password-stdin
docker push ghcr.io/prometheus-protocol/motoko-build:moc-0.16.0
```

Update `docker-compose.yml`:

```yaml
x-base-image:
  versions:
    moc: &moc 0.16.0
    ic-wasm: &ic_wasm 0.9.3
    mops-cli: &mops-cli 0.2.0
  name: &base_name 'ghcr.io/prometheus-protocol/motoko-build:moc-0.16.0'
```

### Option 3: Request Upstream Support

Contact `research-ag/motoko-build-template` maintainers to publish `moc-0.16.0`.

**Pros**: Use trusted upstream source
**Cons**: Waiting on external team, no control over timeline

### Option 4: Version-Aware Verifier (Future Enhancement)

Support multiple `moc` versions by reading from WASM metadata or manifest:

```typescript
// In verifier bot
const mocVersion = await getToolchainVersion(wasmMetadata);
const dockerImage = `ghcr.io/prometheus-protocol/motoko-build:moc-${mocVersion}`;
```

**Pros**: Maximum flexibility, future-proof
**Cons**: Complex, requires infrastructure for multiple base images

## Recommended Approach

**Phase 1 (Immediate)**: Option 2 - Build custom 0.16.0 image

- Takes ~1 hour to implement
- Unblocks all verification
- Uses latest compiler

**Phase 2 (Future)**: Option 4 - Version-aware verifier

- Allows developers to choose compiler version
- Verifier automatically uses matching version
- Requires maintaining multiple base images

## Implementation Checklist

### Phase 1: Custom Base Image

- [ ] Update `Dockerfile.base` with proper MOC installation
- [ ] Build and test base image locally
- [ ] Push to `ghcr.io/prometheus-protocol/motoko-build:moc-0.16.0`
- [ ] Update verifier templates to use new image
- [ ] Update `builder.ts` with new version numbers
- [ ] Update all documentation
- [ ] Test full verification workflow
- [ ] Deploy updated verifier bot

### Files Requiring Updates

- [ ] `packages/apps/verifier-bot/templates/reproducible-build/docker-compose.yml`
- [ ] `packages/apps/verifier-bot/templates/reproducible-build/Dockerfile.base`
- [ ] `packages/apps/verifier-bot/src/builder.ts` (3 locations)
- [ ] `packages/apps/verifier-bot/README.md`
- [ ] `packages/apps/verifier-bot/SPEC.md`
- [ ] `packages/apps/verifier-bot/DEVELOPER-GUIDE.md`
- [ ] `packages/apps/app-store-cli/README.md`
- [ ] All create-motoko-mcp-server templates
- [ ] CI/CD configs (if any)

### Testing Before Deployment

- [ ] Build base image: `docker build -f Dockerfile.base ...`
- [ ] Test with empty canister: `docker-compose run --rm wasm`
- [ ] Verify hash matches upstream test vectors
- [ ] Test with real project from create-motoko-mcp-server
- [ ] Simulate full verification: clone → build → compare hash
- [ ] Test on different platforms (Linux, macOS, Windows)

## Documentation Created

A comprehensive guide has been created: `packages/apps/verifier-bot/MOC-VERSION-UPGRADE.md`

This document covers:

- Why version management matters
- Step-by-step upgrade procedures
- Platform-specific notes
- Rollback procedures
- Migration strategies
- Automated version sync patterns

## Related Issues

- Reproducible builds: #[TBD]
- Developer onboarding: #[TBD]
- Verifier bot deployment: #[TBD]

## References

- Upstream template: https://github.com/research-ag/motoko-build-template
- Available base images: https://github.com/orgs/research-ag/packages/container/package/motoko-build
- Motoko releases: https://github.com/dfinity/motoko/releases
- ic-wasm releases: https://github.com/dfinity/ic-wasm/releases

## Priority

🔴 **CRITICAL** - Blocks all verification functionality

## Labels

- `priority: critical`
- `bug`
- `infrastructure`
- `verifier-bot`
- `reproducible-builds`
