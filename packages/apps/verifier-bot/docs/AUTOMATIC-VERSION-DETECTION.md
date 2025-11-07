# Automatic moc Version Detection

## Overview

The verifier bot automatically detects and uses the `moc` (Motoko compiler) version from each project's `mops.toml` file. This eliminates manual version coordination and allows different projects to use different compiler versions simultaneously.

## How It Works

### 1. Developer Workflow

```toml
# mops.toml in your project
[toolchain]
moc = "0.16.0"  # You choose the version!
```

```bash
# Build with Docker
docker-compose run --rm wasm
# → Uses ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0
```

### 2. Verifier Workflow

```typescript
// When verifier processes your submission:
1. Clone repo at specified commit
2. Read mops.toml: const mocVersion = "0.16.0"
3. Update docker-compose.yml with that version
4. docker-compose run --rm wasm
   // → Uses same image: moc-0.16.0
5. Compare hashes ✅
```

### 3. Version Detection Logic

**File: `packages/apps/verifier-bot/src/builder.ts`**

```typescript
async function setupReproducibleBuild(canisterPath, canisterName, repoRoot) {
  // Read moc version from project's mops.toml
  const mopsPath = path.join(canisterPath, 'mops.toml');
  let mocVersion = '0.16.0'; // Default fallback

  if (fs.existsSync(mopsPath)) {
    const mopsContent = fs.readFileSync(mopsPath, 'utf8');

    // Parse [toolchain] section
    const toolchainMatch = mopsContent.match(
      /\[toolchain\][^\[]*moc\s*=\s*["']([^"']+)["']/,
    );

    if (toolchainMatch) {
      mocVersion = toolchainMatch[1];
      console.log(`🔧 Detected moc version: ${mocVersion}`);
    }
  }

  // Update docker-compose.yml with detected version
  content = content.replace(
    /ghcr\.io\/[^:]+:moc-[0-9.]+/,
    `ghcr.io/prometheus-protocol/motoko-build-template:moc-${mocVersion}`,
  );
}
```

## Benefits

### ✅ For Developers

- **No manual configuration** - Just set your preferred `moc` version in `mops.toml`
- **Freedom to upgrade** - Update `moc` whenever you want without coordinating with anyone
- **Clear versioning** - Your toolchain version is explicit in your codebase

### ✅ For the Ecosystem

- **Multiple versions supported** - Different projects can use different `moc` versions
- **Gradual migrations** - No "big bang" upgrades across all projects
- **Future-proof** - New `moc` releases work automatically

### ✅ For Verifiers

- **Automatic matching** - Always uses the correct version for each project
- **No manual intervention** - Version detection is fully automated
- **Reliable hashing** - Guaranteed to match developer's build

## Example Scenarios

### Scenario 1: New Project with Latest moc

```toml
# Project A - mops.toml
[toolchain]
moc = "0.17.0"  # Using latest
```

✅ Verifier automatically uses `moc-0.17.0` → hashes match

### Scenario 2: Legacy Project on Older moc

```toml
# Project B - mops.toml
[toolchain]
moc = "0.14.3"  # Staying on older version
```

✅ Verifier automatically uses `moc-0.14.3` → hashes match

### Scenario 3: Project Upgrades

**Before:**

```toml
[toolchain]
moc = "0.15.0"
```

**After:**

```toml
[toolchain]
moc = "0.16.0"  # Upgraded!
```

Developer workflow:

1. Update `mops.toml`
2. Rebuild: `docker-compose run --rm wasm`
3. Get new hash
4. Resubmit to registry

✅ Verifier automatically uses new `moc-0.16.0` → hashes match

## Requirements

### Docker Base Images

Each `moc` version needs a corresponding Docker base image:

```
ghcr.io/prometheus-protocol/motoko-build-template:moc-0.14.3
ghcr.io/prometheus-protocol/motoko-build-template:moc-0.15.0
ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0
ghcr.io/prometheus-protocol/motoko-build-template:moc-0.17.0
```

**When a new moc version releases:**

1. Build base image:

   ```bash
   docker build -f Dockerfile.base \
     --build-arg MOC_VERSION=0.17.0 \
     --build-arg IC_WASM_VERSION=0.9.3 \
     -t ghcr.io/prometheus-protocol/motoko-build-template:moc-0.17.0 .
   ```

2. Push to registry:

   ```bash
   docker push ghcr.io/prometheus-protocol/motoko-build-template:moc-0.17.0
   ```

3. Done! Projects can now use `moc = "0.17.0"` in their `mops.toml`

### Fallback Behavior

If `mops.toml` is missing or doesn't specify a `[toolchain]` section:

```typescript
let mocVersion = '0.16.0'; // Default fallback

if (!mopsToml.has('[toolchain]')) {
  console.warn('⚠️  No [toolchain] section, using default: 0.16.0');
  // Verifier generates mops.toml with default version
}
```

## Migration from Manual Version

### Old Way (Manual Coordination)

```yaml
# Hardcoded in verifier templates
versions:
  moc: &moc 0.14.9 # Everyone must use this
```

❌ Problems:

- All projects forced to use same version
- Upgrading requires coordinated migration
- Breaking changes affect everyone simultaneously

### New Way (Automatic Detection)

```toml
# Each project chooses in mops.toml
[toolchain]
moc = "0.16.0"  # Project A
```

```toml
# Different project, different version
[toolchain]
moc = "0.14.3"  # Project B
```

✅ Benefits:

- Projects upgrade independently
- No coordination needed
- Gradual ecosystem migration

## Backwards Compatibility

Projects **must** have `[toolchain]` section in `mops.toml`:

### Migration Checklist for Existing Projects

- [ ] Add `[toolchain]` section to `mops.toml`:

  ```toml
  [toolchain]
  moc = "0.16.0"
  ```

- [ ] Test build locally:

  ```bash
  docker-compose run --rm wasm
  ```

- [ ] Verify hash is consistent

- [ ] Resubmit to registry if needed

### Template Projects

The `create-motoko-mcp-server` template now includes `[toolchain]` by default:

```toml
# Generated mops.toml
[package]
name = "my-mcp-server"
version = "0.1.0"

[dependencies]
base = "0.11.1"

[toolchain]
moc = "0.16.0"  # ← Included automatically
```

## Testing

### Local Testing

```bash
# 1. Set moc version in mops.toml
echo '[toolchain]
moc = "0.16.0"' >> mops.toml

# 2. Build
docker-compose run --rm wasm

# 3. Check logs for version detection
# Expected: "🔧 Detected moc version: 0.16.0"
```

### Integration Testing

```bash
# Simulate verifier
cd /tmp
git clone <your-repo>
cd <your-repo>

# Verifier would run:
# 1. Read mops.toml
# 2. Detect version
# 3. Build with that version

# Manually:
grep 'moc =' mops.toml
docker-compose run --rm wasm
```

## Monitoring

### Verifier Logs

```
📦 Cloning https://github.com/user/project...
🔀 Checking out commit abc123...
📂 Canister path: /tmp/verify-xyz/src
📖 Reading toolchain version from mops.toml...
🔧 Detected moc version: 0.16.0
🐳 Using Docker image: ghcr.io/prometheus-protocol/motoko-build-template:moc-0.16.0
🔨 Building with Docker...
✅ Hash match! Build verified.
```

### Error Scenarios

**Missing Docker image:**

```
❌ Error: Failed to pull image ghcr.io/prometheus-protocol/motoko-build-template:moc-0.99.0
```

**Solution**: Build and push the missing base image, or developer uses supported version.

**No [toolchain] section:**

```
⚠️  No [toolchain] moc version found in mops.toml, using default: 0.16.0
```

**Solution**: Developer adds `[toolchain]` section to their `mops.toml`.

## Summary

| Aspect              | Before                | After                           |
| ------------------- | --------------------- | ------------------------------- |
| Version management  | Hardcoded in verifier | Read from project's `mops.toml` |
| Developer control   | None (forced version) | Full (choose any version)       |
| Coordination needed | Yes (ecosystem-wide)  | No (per-project)                |
| Multiple versions   | Not supported         | ✅ Supported                    |
| Future-proof        | No (manual updates)   | ✅ Yes (automatic)              |
| Migration effort    | High (all at once)    | Low (gradual)                   |

**Result**: Developers have full control over their toolchain while maintaining reproducible builds and automated verification! 🎉
