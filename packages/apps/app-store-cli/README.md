# Prometheus CLI (`@prometheus-protocol/cli`)

A command-line interface for interacting with the Prometheus Protocol, a decentralized software supply chain for the Internet Computer.

This tool allows developers to publish, version, and manage secure, auditable software, and enables operators to safely upgrade their running canisters to trusted new versions.

## Core Concepts

Before using the CLI, it's important to understand a few key concepts:

- **Namespace:** A unique, reverse-domain-style identifier for your application type (e.g., `com.my-company.my-app`). All versions of your application will live under this namespace.
- **App Metadata vs. Version Data:** The `prometheus.yml` file contains two types of information. The `app` section holds mutable "marketing" metadata (like descriptions and icons) that you can change anytime. The `submission` section holds immutable data (like a git commit hash) that is locked to a specific audit.
- **Verification:** The process of submitting your canister's WASM for auditing. The CLI helps you initiate this process, which is then carried out by off-chain auditors who file on-chain attestations.
- **Developer vs. Operator:** The CLI is designed around two distinct roles:
  - **The Developer:** The person or team who writes the code, submits it for verification, and publishes new versions to the registry.
  - **The Operator:** The person, team, or DAO who runs a live instance of a canister and needs to upgrade it to a new version published by the developer.
- **Publish vs. Upgrade:** These are two separate and critical actions:
  - `publish` is done by a **Developer** to make a new version _available_ in the registry.
  - `upgrade` is done by an **Operator** to apply a published version to their _live canister_.

## Prerequisites

1.  **Node.js and npm:** You must have Node.js (v18 or higher) and npm installed.
2.  **Internet Computer SDK:** You need `dfx` installed and a `dfx` identity created. You can check your current identity with `dfx identity whoami`.

## Installation

```bash
npm install -g @prometheus-protocol/cli
```

## The Developer Journey: Publishing Your Application

This workflow takes your local code and makes it a trusted, published version in the registry, with a corresponding public-facing app page.

### Step 1: Initialize Your Project

In your project's root directory, run the `init` command. This creates a `prometheus.yml` file that describes your application.

```bash
@prometheus-protocol/cli init
```

You will be prompted for your application's namespace, name, description, and repository URL. This file is the single source of configuration for all other CLI commands.

---

### The Verification & Publishing Flow (For a New Version)

This is the core flow for getting your code audited and released.

#### Step 2a: Submit for Verification

Once your code is ready for audit, fill in the `git_commit` and `wasm_path` in the `submission` section of your `prometheus.yml`, then run `submit`.

```bash
@prometheus-protocol/cli submit
```

This command reads your manifest, calculates your WASM hash, and submits it to the registry to begin the audit process.

#### Step 2b: Check Verification Status

You can check on the progress of the audit at any time.

```bash
@prometheus-protocol/cli status
```

#### Step 2c: Publish the Verified Version

After the off-chain audit process is complete and your WASM is marked as verified, you can officially publish it with a semantic version.

```bash
@prometheus-protocol/cli publish --version 1.0.0
```

This creates a new version record (e.g., `v1.0.0`) in the registry, links it to the verified WASM hash, and makes it available for operators to upgrade to.

---

### Managing Your App's Metadata (Marketing Info)

This flow is for managing your application's public-facing page in the app store.

#### Step 2d: Update Your App's Metadata

You can update your app's name, description, icon URLs, etc., at any time. Simply edit the `app` section of your `prometheus.yml` file and run the `update-metadata` command.

```bash
@prometheus-protocol/cli update-metadata
```

This pushes your local marketing metadata to the on-chain metadata canister, updating your app's page without requiring a new code audit.

---

### Step 3: Manage Permissions

To allow an operator to upgrade their canisters to your new version, you must grant them permission.

```bash
# Grant permission
@prometheus-protocol/cli add-controller --principal <operator-principal-id>

# Revoke permission later if needed
@prometheus-protocol/cli remove-controller --principal <operator-principal-id>
```

## The Operator Journey: Upgrading a Live Canister

This workflow is for managing a live canister and upgrading it to a new, trusted version from the registry.

### Step 1: Register Your Canister (One-Time Setup)

Before you can upgrade a canister, you must register it with the Prometheus orchestrator, linking it to the namespace of the application it runs. You only need to do this once per canister.

```bash
@prometheus-protocol/cli register --canister <your-canister-id> --namespace com.my-company.my-app
```

**Note:** This will only succeed if the developer has already added your principal as a controller for that namespace.

### Step 2: Discover Available Versions

To see what versions are available to upgrade to, use `list-versions`.

```bash
@prometheus-protocol/cli list-versions --namespace com.my-company.my-app
```

This will show you a table of all published versions, their descriptions, and whether they have been marked as deprecated.

### Step 3: Perform the Upgrade

Once you've chosen a version, run the `upgrade` command.

```bash
@prometheus-protocol/cli upgrade --canister <your-canister-id> --version 1.0.1
```

This command will securely fetch the WASM hash for `v1.0.1` from the registry and instruct the orchestrator to perform the upgrade on your canister.

### Step 4: Check the Upgrade Status

An upgrade is a process. To confirm if it completed successfully, use the `upgrade-status` command.

```bash
@prometheus-protocol/cli upgrade-status
```

This will poll the orchestrator and report whether the last upgrade you initiated was successful, failed, or is still in progress.

## Full Command Reference

| Command             | Description                                                   | Key Options                                    |
| :------------------ | :------------------------------------------------------------ | :--------------------------------------------- |
| `add-controller`    | Grants upgrade permission to a principal.                     | `-p, --principal <id>`                         |
| `deprecate`         | Marks a specific version as deprecated (or not).              | `-n <ns>`, `-v <ver>`, `-r <reason>`, `--undo` |
| `init`              | Creates a `prometheus.yml` manifest in the current directory. |                                                |
| `list-controllers`  | Lists all principals authorized to upgrade for a namespace.   | `-n, --namespace <ns>`                         |
| `list-versions`     | Lists all published versions for a namespace.                 | `-n, --namespace <ns>`                         |
| `publish`           | Publishes a new, verified version to the registry.            | `-v, --version <version>`                      |
| `register`          | Links a live canister to a namespace for future upgrades.     | `-c, --canister <id>`, `-n <ns>`               |
| `remove-controller` | Revokes upgrade permission from a principal.                  | `-p, --principal <id>`                         |
| `status`            | Checks the verification status of the local WASM.             |                                                |
| `submit`            | Submits the local WASM for verification.                      |                                                |
| `update-metadata`   | Updates the app's marketing metadata from the manifest.       |                                                |
| `upgrade`           | Upgrades a live canister to a published version.              | `-c <id>`, `-v <ver>`, `--mode`, `--arg`       |
| `upgrade-status`    | Polls for the status of the last initiated upgrade.           |                                                |
