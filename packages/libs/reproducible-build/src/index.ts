import fs from 'fs';
import path from 'path';
import toml from 'toml';

/**
 * Template files for reproducible Motoko builds
 * Updated for npm publish compatibility
 */
export const TEMPLATES = {
  'docker-compose.yml': `x-base-image:
  versions:
    moc: &moc {{MOC_VERSION}}
    ic-wasm: &ic_wasm {{IC_WASM_VERSION}}
    mops-cli: &mops-cli {{MOPS_CLI_VERSION}}
  name: &base_name 'motoko-build-base:moc-{{MOC_VERSION}}'

networks:
  default:
    external: true
    name: verifier-shared-network

services:
  base:
    build:
      context: .
      dockerfile: Dockerfile.base
      args:
        MOC_VERSION: *moc
        IC_WASM_VERSION: *ic_wasm
        MOPS_CLI_VERSION: *mops-cli
    image: *base_name
  wasm:
    depends_on:
      - base
    build:
      context: .
      args:
        IMAGE: *base_name
    volumes:
      - ./out:/project/out
    environment:
      compress: "false"
    command: bash --login build.sh
`,

  Dockerfile: `ARG IMAGE
FROM --platform=linux/amd64 \${IMAGE}

WORKDIR /project

COPY mops.toml ./

# Let mops-cli install the dependencies defined in mops.toml and create
# mops.lock.
# Note: We trick mops-cli into not downloading binaries and not compiling
# anything. We also make it use the moc version from the base image.
# Accept GITHUB_TOKEN as build arg to authenticate API requests (optional)
ARG GITHUB_TOKEN
RUN mkdir -p ~/.mops/bin \\
    && ln -s /usr/local/bin/moc ~/.mops/bin/moc \\
    && touch ~/.mops/bin/mo-fmt \\
    && if [ -n "\${GITHUB_TOKEN}" ]; then export GITHUB_TOKEN="\${GITHUB_TOKEN}"; fi \\
    && echo "persistent actor {}" >tmp.mo \\
    && mops-cli build tmp.mo -- --check \\
    && rm -r tmp.mo target/tmp

COPY src /project/src/
COPY di[d] /project/did/
COPY build.sh /project

CMD ["/bin/bash"]
`,

  'Dockerfile.base': `ARG PLATFORM=linux/amd64
FROM --platform=\${PLATFORM} alpine:latest AS build

RUN apk add --no-cache curl ca-certificates tar bash \\
    && update-ca-certificates

RUN mkdir -p /install/bin

# Install ic-wasm
ARG IC_WASM_VERSION
RUN curl -L https://github.com/research-ag/ic-wasm/releases/download/\${IC_WASM_VERSION}/ic-wasm-x86_64-unknown-linux-musl.tar.gz -o ic-wasm.tgz \\
    && tar xzf ic-wasm.tgz \\
    && install ic-wasm /install/bin

# Install mops-cli 
ARG MOPS_CLI_VERSION
RUN curl -L https://github.com/prometheus-protocol/mops-cli/releases/download/v\${MOPS_CLI_VERSION}/mops-cli-linux64 -o mops-cli \\
    && install mops-cli /install/bin

# Install moc (use version-aware URL)
ARG MOC_VERSION
RUN version_compare() { \\
      [ "\$1" = "\$2" ] && return 1; \\
      [ "\$(printf '%s\\n' "\$1" "\$2" | sort -V | head -n1)" != "\$1" ]; \\
    }; \\
    if version_compare "\${MOC_VERSION}" "0.9.5"; then \\
      curl -L https://github.com/dfinity/motoko/releases/download/\${MOC_VERSION}/motoko-Linux-x86_64-\${MOC_VERSION}.tar.gz -o motoko.tgz; \\
    else \\
      curl -L https://github.com/dfinity/motoko/releases/download/\${MOC_VERSION}/motoko-linux64-\${MOC_VERSION}.tar.gz -o motoko.tgz; \\
    fi \\
    && tar xzf motoko.tgz \\
    && install moc /install/bin 

FROM --platform=\${PLATFORM} alpine:latest
RUN apk add bash
COPY --from=build /install/bin/* /usr/local/bin/
`,

  'build.sh': `#!/bin/bash

# Get moc version (extract X.Y.Z format)
MOC_VERSION=$(moc --version 2>&1 | grep -o '[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+' | head -n1)

# Version comparison function for Alpine (uses sort -V)
version_gte() {
  [ "$1" = "$2" ] && return 0
  [ "$(printf '%s\\n' "$1" "$2" | sort -V | head -n1)" != "$1" ]
}

version_lt() {
  [ "$1" = "$2" ] && return 1
  [ "$(printf '%s\\n' "$1" "$2" | sort -V | head -n1)" = "$1" ]
}

# Add --enhanced-orthogonal-persistence only for moc 0.14.4
# (earlier versions don't support it, 0.15.0+ has it as default)
PERSISTENCE_FLAG=""
if version_gte "$MOC_VERSION" "0.14.4" && version_lt "$MOC_VERSION" "0.15.0"; then
    PERSISTENCE_FLAG="--enhanced-orthogonal-persistence"
fi

MOC_GC_FLAGS="" ## place any additional flags like compacting-gc, incremental-gc here
MOC_FLAGS="$MOC_GC_FLAGS $PERSISTENCE_FLAG -no-check-ir --release --public-metadata candid:service --public-metadata candid:args"
OUT=out/out_$(uname -s)_$(uname -m).wasm
mops-cli build --lock --name out src/main.mo -- $MOC_FLAGS
cp target/out/out.wasm $OUT
ic-wasm $OUT -o $OUT shrink
if [ -f did/service.did ]; then
    echo "Adding service.did to metadata section."
    ic-wasm $OUT -o $OUT metadata candid:service -f did/service.did -v public
else
    echo "service.did not found. Skipping metadata update."
fi
if [ "$compress" == "yes" ] || [ "$compress" == "y" ]; then
  gzip -nf $OUT
  sha256sum $OUT.gz
else
  sha256sum $OUT
fi
`,
} as const;

/**
 * Default versions for reproducible builds
 */
export const DEFAULT_VERSIONS = {
  MOC_VERSION: '0.16.0',
  IC_WASM_VERSION: '0.9.3',
  MOPS_CLI_VERSION: '0.2.1',
} as const;

export const REQUIRED_FILES = [
  'docker-compose.yml',
  'Dockerfile',
  'Dockerfile.base',
  'build.sh',
] as const;

export interface BuildConfig {
  projectPath: string;
  mocVersion?: string;
  icWasmVersion?: string;
  mopsCliVersion?: string;
}

/**
 * Extract Motoko compiler version from mops.toml
 */
export function getMocVersionFromMopsToml(projectPath: string): string | null {
  const mopsTomlPath = path.join(projectPath, 'mops.toml');

  if (!fs.existsSync(mopsTomlPath)) {
    return null;
  }

  try {
    const mopsTomlContent = fs.readFileSync(mopsTomlPath, 'utf-8');
    const mopsConfig = toml.parse(mopsTomlContent);
    return mopsConfig?.toolchain?.moc || null;
  } catch (error) {
    console.warn(`Failed to parse mops.toml: ${error}`);
    return null;
  }
}

/**
 * Find dfx.json by walking up the directory tree (for monorepos)
 */
export function findDfxJson(startPath: string): string | null {
  let currentPath = startPath;

  while (currentPath !== path.parse(currentPath).root) {
    const dfxJsonPath = path.join(currentPath, 'dfx.json');
    if (fs.existsSync(dfxJsonPath)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

/**
 * Find mops.toml by walking up the directory tree (for monorepos)
 */
export function findMopsToml(startPath: string): string | null {
  let currentPath = startPath;

  while (currentPath !== path.parse(currentPath).root) {
    const mopsTomlPath = path.join(currentPath, 'mops.toml');
    if (fs.existsSync(mopsTomlPath)) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

/**
 * Check if all required build files exist
 */
export function hasRequiredBuildFiles(projectPath: string): boolean {
  return REQUIRED_FILES.every((file) =>
    fs.existsSync(path.join(projectPath, file)),
  );
}

/**
 * Create reproducible build files in the project directory
 */
export function bootstrapBuildFiles(config: BuildConfig): void {
  const { projectPath } = config;

  // Determine moc version from mops.toml or use provided/default
  const mocVersionFromToml = getMocVersionFromMopsToml(projectPath);
  const mocVersion =
    config.mocVersion || mocVersionFromToml || DEFAULT_VERSIONS.MOC_VERSION;

  const versions = {
    MOC_VERSION: mocVersion,
    IC_WASM_VERSION: config.icWasmVersion || DEFAULT_VERSIONS.IC_WASM_VERSION,
    MOPS_CLI_VERSION:
      config.mopsCliVersion || DEFAULT_VERSIONS.MOPS_CLI_VERSION,
  };

  // Create build files from templates
  for (const [filename, template] of Object.entries(TEMPLATES)) {
    const filePath = path.join(projectPath, filename);

    // Replace version placeholders
    let content: string = template;
    for (const [key, value] of Object.entries(versions)) {
      content = content.replaceAll(`{{${key}}}`, value);
    }

    fs.writeFileSync(filePath, content, 'utf-8');

    // Make build.sh executable
    if (filename === 'build.sh') {
      fs.chmodSync(filePath, 0o755);
    }
  }

  // Create out directory if it doesn't exist
  const outDir = path.join(projectPath, 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

/**
 * Validate project has required Motoko files
 * For monorepos, this checks the canister directory for src folder
 * (mops.toml is expected at the project root, not here)
 */
export function validateMotokoProject(projectPath: string): {
  valid: boolean;
  missing: string[];
} {
  const required = ['src'];
  const missing: string[] = [];

  for (const file of required) {
    if (!fs.existsSync(path.join(projectPath, file))) {
      missing.push(file);
    }
  }

  return { valid: missing.length === 0, missing };
}
