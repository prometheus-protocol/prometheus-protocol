# Prometheus App Store CLI

The official command-line interface for the Prometheus Protocol. This tool provides a complete suite of commands for ai agents, developers, and auditors to manage the full lifecycle of a decentralized application.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [DFX SDK](https://internetcomputer.org/docs/current/developer-docs/setup/install/) (for identity management)
- [Docker](https://docs.docker.com/get-docker/) (for reproducible builds)

## Installation & Usage

The CLI is designed for two primary use cases:

**1. For Developers (Inside a Project):**
The CLI is included as a `devDependency` in projects created with `create-motoko-mcp-server`. You will interact with it via `npm run` scripts defined in your `package.json`:

```bash
# Example from within your app project
npm run app-store -- <command> [options]
```

_Note the required `--` to pass arguments to the script._

**2. For Auditors:**
External users should use `npx` with the full, scoped package name to ensure they are always running the latest version.

```bash
# Example for an auditor
npx @prometheus-protocol/app-store-cli <command> [options]
```

For frequent use, you can install it globally:

```bash
npm install -g @prometheus-protocol/app-store-cli
```

## Core Concepts

The CLI is organized around the primary roles within the Prometheus Protocol ecosystem:

- **🧑‍💻 Developers:** Build applications, submit them for verification, and publish new versions.
- **🕵️ Auditors:** Discover bounties, perform security and quality audits, and submit attestations.

## Commands

All commands can be run with the `--help` flag for more details (e.g., `npx @prometheus-protocol/app-store-cli bounty --help`).

---

### **🧑‍💻 Developer Commands**

Commands for managing the application lifecycle from within your project.

- `npm run app-store init`
  - Initializes a new **`prometheus.yml`** configuration file in the current directory.
- `npm run app-store submit`
  - Submits your WASM hash and metadata for verification based on your config.
- `npm run app-store status`
  - Checks the current verification status of your application.
- `npm run app-store -- publish`
  - Publishes a new, verified version of your application to the App Store.

---

### **🕵️ Auditor & Bounty Commands**

Commands for discovering, auditing, and claiming rewards.

- `npx @prometheus-protocol/app-store-cli bounty list`
  - Lists all available bounties on the network, showing their status (Open, Reserved, or Claimed).
- `npx @prometheus-protocol/app-store-cli bounty reserve <bounty-id>`
  - Reserves an open bounty by staking reputation tokens, granting an exclusive lock.
- `npx @prometheus-protocol/app-store-cli bounty create`
  - Creates a new bounty to incentivize a specific audit for a WASM.
- `npx @prometheus-protocol/app-store-cli bounty claim <bounty-id>`
  - Claims a **reserved** bounty after the corresponding attestation has been successfully submitted.
- `npx @prometheus-protocol/app-store-cli attest generate`
  - Generates a template YAML file for a specific audit type.
- `npx @prometheus-protocol/app-store-cli attest submit <file> --bounty-id <id>`
  - Submits a completed attestation file **for a reserved bounty.**

---

## 📖 End-to-End Workflow Example

This example shows the complete journey, using the correct invocation for each role.

#### 1. Developer Builds and Submits for Audit (from their project)

**⚠️ CRITICAL: Build Reproducibility**

Your WASM **must** be built using the reproducible Docker environment. The verifier will rebuild your code from source and compare SHA-256 hashes. If you build natively (e.g., `dfx build`), the hashes **will not match** and verification will fail.

**Step 1: Build your WASM reproducibly**

```bash
# Build using Docker (this ensures reproducibility across platforms)
docker-compose run --rm wasm

# Your WASM will be in: out/out_Linux_x86_64.wasm
# The build script will print the SHA-256 hash
```

**Step 2: Specify your moc version in mops.toml**

```toml
[toolchain]
moc = "0.16.0"  # ← The verifier will automatically use this version!
```

**Step 3: Update your manifest**

Edit `prometheus.yml` to point to the reproducibly-built WASM:

```yaml
namespace: my-app
submission:
  repo_url: https://github.com/yourname/your-app
  wasm_path: ./out/out_Linux_x86_64.wasm # ← Must be the Docker build output
  git_commit: abc123... # ← Current commit hash
  name: My Application
  description: A secure MCP server
```

**Step 4: Submit for verification**

```bash
npm run app-store init  # If you haven't already
npm run app-store submit
npm run app-store status
```

**Why Docker?**

The Docker build environment uses pinned toolchain versions specified in your `mops.toml`:

- `moc` (Motoko compiler) - **Your choice!** (e.g., `0.16.0`)
- `ic-wasm` version 0.9.3
- `mops-cli` version 0.2.0

The verifier automatically detects your `moc` version from `mops.toml` and uses the matching Docker image. This ensures your WASM hash **exactly matches** what the verifier produces, regardless of your host OS (macOS, Windows, Linux).

**📚 For detailed build instructions, troubleshooting, and CI/CD examples, see:**

- [Developer Guide: Reproducible Builds](../verifier-bot/DEVELOPER-GUIDE.md)
- [Reproducible Build Template](../../libs/icrc118/README.md)

#### 2. Sponsor Creates a Bounty (standalone)

- `npx @prometheus-protocol/app-store-cli bounty create 100000000 <token-canister-id> --wasm-id <wasm_id> --audit-type data_safety_v1`

#### 3. Auditor Discovers and Completes the Audit (standalone)

- Discover work: `npx @prometheus-protocol/app-store-cli bounty list`
- **Reserve the bounty:** `npx @prometheus-protocol/app-store-cli bounty reserve <bounty_id>`
- Generate template: `npx @prometheus-protocol/app-store-cli attest generate --type data_safety_v1`
- **Edit the generated `attestation.yml`** with your findings.
- Submit work for the bounty: `npx @prometheus-protocol/app-store-cli attest submit attestation.yml --bounty-id <bounty_id>`
- Get paid: `npx @prometheus-protocol/app-store-cli bounty claim <bounty_id>`

#### 4. Developer Publishes the Verified Version (from their project)

- Check for approval: `npm run app-store status`
- Publish the new version: `npm run app-store -- publish --app-version "0.1.0"`

#### 5. End User Installs the App

- The user can now find the verified application in the App Store, inspect its audit certificate, and install it with confidence.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
