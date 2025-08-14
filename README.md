# Prometheus Protocol

A decentralized software supply chain for AI agents on the Internet Computer.

<img width="1536" alt="Prometheus Protocol Banner" src="images/banner-professional.png" />

## Overview

Prometheus Protocol is a complete, on-chain system for publishing, verifying, and deploying software in a trustless environment. It provides a decentralized app store for **Model Context Protocol (MCP)** servers, enabling AI agents to securely discover and use community-verified tools.

The protocol establishes a transparent workflow between developers, auditors, and a governing DAO, ensuring that all software published through the registry meets community standards for security and quality. This is all orchestrated through a simple command-line interface, `@prometheus-protocol/cli`.

## How It Works: The Publishing Lifecycle

The protocol is built around a clear, auditable lifecycle that takes a developer's code from a local WASM file to a verified, deployable canister on the Internet Computer.

1.  **Submission:** A **Developer** uses the `@prometheus-protocol/cli` CLI to submit their application's WASM hash and source code repository URL to the `mcp_registry` canister. This creates a public, on-chain verification request (ICRC-126).
2.  **Auditing:** Independent **Auditors** discover these requests. They review the source code for vulnerabilities and correctness. If the code is sound, they file a signed attestation on-chain, linked to the specific WASM hash.
3.  **Finalization:** The **DAO** observes the attestations. Once a sufficient number of trusted auditors have approved a WASM, the DAO finalizes it, marking it as officially "verified" in the registry.
4.  **Publication:** The Developer can now use `@prometheus-protocol/cli` to link this verified WASM to a semantic version (e.g., v1.2.0) in their application's official record (ICRC-118).
5.  **Deployment:** Users and other systems can now ask the `mcp_orchestrator` to deploy a new instance of the application. The orchestrator will only ever deploy WASM versions that have been finalized by the DAO, guaranteeing a secure software supply chain.

## The Developer Workflow

Getting your application published is managed entirely through our command-line tool.

### 1. Initialize Your Project

Run the `init` command in your project's root directory. This creates a `prometheus.yml` manifest file.

```bash
npx @prometheus-protocol/cli init
```

You will be prompted for your app's name and namespace. Then, edit the generated file to add your repository URL and the path to your compiled WASM.

**`prometheus.yml`**

```yaml
name: My Awesome App
namespace: com.mycompany.app
repo_url: https://github.com/my-org/my-repo
wasm_path: ./build/my_canister.wasm
```

### 2. Submit for Verification

Once your manifest is complete, run the `submit` command. This reads the manifest, hashes your WASM, and creates the on-chain verification request.

```bash
npx @prometheus-protocol/cli submit
```

### 3. Check Verification Status

Use the `status` command to see the progress of audits and the final DAO verification for your WASM.

```bash
npx @prometheus-protocol/cli status
```

### 4. Publish a New Version

After your WASM has been successfully verified by the auditors and finalized by the DAO, you can publish it as a new version of your application.

```bash
npx @prometheus-protocol/cli publish
```

## Ecosystem Components

The protocol is composed of several key canisters and tools working in concert:

- **`mcp_registry`:** The core of the app store. It implements `ICRC-118` for version management and `ICRC-126`/`ICRC-127` to manage the verification, auditing, and bounty lifecycle.
- **`mcp_orchestrator`:** The deployment engine. It implements `ICRC-120` to securely deploy new canister instances using only DAO-verified WASM files.
- **`auth_server`:** A full-featured, on-chain OAuth 2.1 provider that handles identity and authorization for the entire ecosystem.
- **`@prometheus-protocol/cli` (CLI):** The developer-facing tool for interacting with the entire publishing lifecycle.

<details>
  <summary><strong>Deep Dive: The Authentication Layer (OAuth 2.1)</strong></summary>

### Auth Server Features & Compliance

The `auth_server` canister is a general-purpose OAuth 2.1 provider built for the IC.

- ✓ **OAuth 2.1 Core:** Implements the modern, secure baseline for OAuth, including mandatory PKCE (`RFC 7636`).
- ✓ **Refresh Token Rotation:** Enhances security by issuing a new, single-use refresh token each time one is used.
- ✓ **Dynamic Client Registration (DCR):** A public `/register` endpoint (`RFC 7591`) for programmatic client registration.
- ✓ **Resource Indicators:** Supports token audience binding via the `resource` parameter (`RFC 8707`).
- ✓ **ICRC-2 Payment Authorization:** Enables resource servers to specify a list of accepted ICRC-2 tokens for payment-gated scopes.
- ✓ **Server Metadata:** Provides `/.well-known/oauth-authorization-server` (`RFC 8414`) for automated client configuration.
- ✓ **MCP Authorization Spec Compliant:** Fully adheres to the requirements for an Authorization Server within the MCP ecosystem.

### On-Chain Security Model

Building a secure OAuth 2.1 provider on a public blockchain requires a specific design. The core principles are:

1.  **PKCE as a Hard Requirement:** This is the primary defense against authorization code interception attacks.
2.  **Secret `request_id` for Token Exchange:** For non-IC clients, the `/token` endpoint is an `update` call. The response (containing the secret access token) is stored at a path in the IC's state tree derived from a secret `request_id`. This ID is a hash of secrets known only to the client, making the path unguessable by an attacker.
3.  **Certified Responses:** The response delivered to the client is cryptographically certified by the IC, ensuring it is authentic and untampered, even if delivered by a malicious boundary node.

</details>

## Getting Started (Local Development)

### Prerequisites

- [DFINITY Canister SDK (dfx)](https://internetcomputer.org/docs/current/developer-docs/setup/install/)
- [Node.js](https://nodejs.org/) & [npm](https://nodejs.org/)
- [Mops](https://mops.one/) (Motoko Package Manager)

### 1. Clone & Install

```bash
git clone https://github.com/prometheus-protocol/prometheus-protocol.git
cd prometheus-protocol
npm install
mops install
```

### 2. Deploy Local Environment

This command starts a local replica and deploys all the Prometheus canisters (`mcp_registry`, `mcp_orchestrator`, `auth_server`, etc.).

```bash
dfx start --clean --background
dfx deploy
```

## Running Tests

The project includes a comprehensive test suite using Vitest for E2E tests and `mo:test` for unit tests.

```bash
# Run all Motoko unit and integration tests
mops test

# Run all TypeScript end-to-end tests
npm run test
```

## License

This project is licensed under the MIT License.
