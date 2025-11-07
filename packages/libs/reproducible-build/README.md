# @prometheus-protocol/reproducible-build

Shared library for reproducible Motoko canister builds using Docker.

## Overview

This library provides templates and utilities to set up reproducible build environments for Motoko canisters. It ensures that builds are deterministic and can be verified by anyone.

## Features

- **Docker templates**: Pre-configured Dockerfile and docker-compose.yml
- **Build scripts**: Standardized build.sh with IC tooling
- **Version management**: Automatic detection of Motoko compiler version from mops.toml
- **Monorepo support**: Finds dfx.json and mops.toml in parent directories
- **Validation**: Checks project structure before building

## Installation

```bash
pnpm add @prometheus-protocol/reproducible-build
```

## Usage

### Bootstrap Build Files

```typescript
import { bootstrapBuildFiles } from '@prometheus-protocol/reproducible-build';

bootstrapBuildFiles({
  projectPath: '/path/to/canister',
  mocVersion: '0.16.0', // Optional: auto-detected from mops.toml
});
```

This creates:

- `docker-compose.yml` - Container orchestration
- `Dockerfile` - Build environment
- `Dockerfile.base` - Base image with Motoko tooling
- `build.sh` - Build script
- `out/` - Output directory for WASM

### Validate Project

```typescript
import { validateMotokoProject } from '@prometheus-protocol/reproducible-build';

const result = validateMotokoProject('/path/to/canister');
if (!result.valid) {
  console.error('Missing:', result.missing);
}
```

### Find Project Files

```typescript
import {
  findDfxJson,
  findMopsToml,
} from '@prometheus-protocol/reproducible-build';

// For monorepos - walks up directory tree
const dfxRoot = findDfxJson(process.cwd());
const mopsRoot = findMopsToml(process.cwd());
```

### Get Motoko Version

```typescript
import { getMocVersionFromMopsToml } from '@prometheus-protocol/reproducible-build';

const version = getMocVersionFromMopsToml('/path/to/canister');
// Returns: "0.16.0" or null if not found
```

### Check Build Files

```typescript
import { hasRequiredBuildFiles } from '@prometheus-protocol/reproducible-build';

if (!hasRequiredBuildFiles('/path/to/canister')) {
  console.log('Run bootstrap to create build files');
}
```

## Templates

Templates use placeholder syntax for dynamic values:

```yaml
# docker-compose.yml
x-base-image:
  versions:
    moc: &moc { { MOC_VERSION } }
```

These are replaced during `bootstrapBuildFiles()`:

- `{{MOC_VERSION}}` - Motoko compiler version
- `{{DFX_VERSION}}` - DFX SDK version
- `{{IC_WASM_VERSION}}` - ic-wasm tool version
- `{{MOPS_CLI_VERSION}}` - mops CLI version

## Default Versions

```typescript
import { DEFAULT_VERSIONS } from '@prometheus-protocol/reproducible-build';

console.log(DEFAULT_VERSIONS);
// {
//   DFX_VERSION: '0.14.9',
//   MOC_VERSION: '0.14.9',
//   IC_WASM_VERSION: '0.9.3',
//   MOPS_CLI_VERSION: '0.2.0'
// }
```

## Used By

- `@prometheus-protocol/app-store-cli` - CLI build command
- `@prometheus-protocol/verifier-bot` - Automated build verification

## Architecture

This library centralizes reproducible build logic that was previously duplicated across:

- Root `/templates` directory
- Hardcoded strings in app-store-cli
- Embedded templates in verifier-bot

Now all apps import from a single source of truth.

## License

MIT
