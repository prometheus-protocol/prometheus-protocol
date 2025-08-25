# Prometheus App Store CLI

The official command-line interface for the Prometheus Protocol. This tool provides a complete suite of commands for developers, auditors, and DAO members to manage the full lifecycle of a decentralized application.

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

**2. For Auditors & DAO Members (Standalone):**
External users should use `npx` with the full, scoped package name to ensure they are always running the latest version.

```bash
# Example for an auditor or DAO member
npx @prometheus-protocol/app-store-cli <command> [options]
```

For frequent use, you can install it globally:

```bash
npm install -g @prometheus-protocol/app-store-cli
```

## Core Concepts

The CLI is organized around the three primary roles within the Prometheus Protocol ecosystem:

- **🧑‍💻 Developers:** Build applications, submit them for verification, and publish new versions.
- **🕵️ Auditors:** Discover bounties, perform security and quality audits, and submit attestations.
- **🏛️ DAO Members:** Review completed audits and provide the final on-chain verification for a submission.

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
  - Publishes a new, DAO-verified version of your application to the App Store.

---

### **🕵️ Auditor & Bounty Commands**

Commands for discovering, auditing, and claiming rewards.

- `npx @prometheus-protocol/app-store-cli bounty list`
  - Lists all available bounties on the network, with powerful filtering options.
- `npx @prometheus-protocol/app-store-cli bounty create`
  - Creates a new bounty to incentivize a specific audit for a WASM.
- `npx @prometheus-protocol/app-store-cli bounty claim`
  - Claims a bounty after a corresponding attestation has been filed.
- `npx @prometheus-protocol/app-store-cli attest generate`
  - Generates a template JSON file for a specific audit type.
- `npx @prometheus-protocol/app-store-cli attest submit`
  - Submits a completed attestation file to the network.

---

### **🏛️ DAO Commands**

Commands for governance and final verification.

- `npx @prometheus-protocol/app-store-cli dao list`
  - Lists all WASM submissions that have new, unreviewed attestations.
- `npx @prometheus-protocol/app-store-cli dao generate-ballot`
  - Generates a template file for a DAO member to formalize their vote.
- `npx @prometheus-protocol/app-store-cli dao finalize`
  - Submits a completed decision ballot file to finalize a submission.

---

## 📖 End-to-End Workflow Example

This example shows the complete journey, using the correct invocation for each role.

#### 1. Developer Submits for Audit (from their project)

- `npm run app-store init`
- `npm run app-store submit`
- `npm run app-store status`

#### 2. Sponsor Creates a Bounty (standalone)

- `npx @prometheus-protocol/app-store-cli bounty create --wasm-id <wasm_id> --type app_info_v1 --amount 1000000`

#### 3. Auditor Discovers and Completes the Audit (standalone)

- Discover work: `npx @prometheus-protocol/app-store-cli bounty list`
- Generate template: `npx @prometheus-protocol/app-store-cli attest generate --type app_info_v1`
- Submit work: `npx @prometheus-protocol/app-store-cli attest submit --file attestation.json`
- Get paid: `npx @prometheus-protocol/app-store-cli bounty claim --bounty-id <bounty_id>`

#### 4. DAO Reviews and Finalizes (standalone)

- Discover pending work: `npx @prometheus-protocol/app-store-cli dao list`
- Generate a decision ballot: `npx @prometheus-protocol/app-store-cli dao generate-ballot --wasm-id <wasm_id>`
- **Edit the generated `ballot.json`** to set the outcome to `Verified` or `Rejected`.
- Submit the completed ballot: `npx @prometheus-protocol/app-store-cli dao finalize --file ballot.json`

#### 5. Developer Publishes the Verified Version (from their project)

- Check for DAO approval: `npm run app-store status`
- Publish the new version: `npm run app-store -- publish --app-version "0.1.0"`

#### 6. End User Installs the App

- The user can now find the verified application in the App Store, inspect its audit certificate, and install it with confidence.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.
