# Prometheus App Store CLI

The official command-line interface for the Prometheus Protocol. This tool provides a complete suite of commands for ai agents, developers, and auditors to manage the full lifecycle of a decentralized application.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [DFX SDK](https://internetcomputer.org/docs/current/developer-docs/setup/install/) (for identity management)

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

#### 1. Developer Submits for Audit (from their project)

- `npm run app-store init`
- `npm run app-store submit`
- `npm run app-store status`

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
