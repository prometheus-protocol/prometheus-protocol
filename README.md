<p align="center">
  <a href="https://github.com/prometheus-protocol/prometheus-protocol">
    <img alt="prometheus-banner" src="https://github.com/user-attachments/assets/0e0cc899-def2-42dc-a365-a34512f280ba" />
  </a>
</p>

<p align="right">
  <i>If you find this project useful, please star it ✨</i>
</p>

<p align="center">
  <a href="https://github.com/prometheus-protocol/prometheus-protocol/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
  <a href="https://www.npmjs.com/package/@prometheus-protocol/cli">
    <img alt="NPM Version" src="https://img.shields.io/npm/v/@prometheus-protocol/cli.svg"/>
  </a>
  <a href="https://github.com/prometheus-protocol/prometheus-protocol/actions/workflows/tests.yml">
    <img alt="Tests" src="https://github.com/prometheus-protocol/prometheus-protocol/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://discord.gg/TbqgYERjYw">
    <!-- TODO: Replace with your actual Discord invite link -->
    <img alt="Join our Discord" src="https://dcbadge.limes.pink/api/server/https://discord.gg/TbqgYERjYw?style=flat"/>
  </a>
  <img alt="Version" src="https://img.shields.io/github/package-json/v/prometheus-protocol/prometheus-protocol"/>
</p>

---

<h2 align="center">Prometheus Protocol Monorepo</h2>
<p align="center">🏛️ <b>The Trust Layer for the AI Economy on the Internet Computer.</b></p>

---

<p align="center">
  <b>Please note that this project is under active development. APIs might change before version 1 is released.</b>
</p>

## Table of Contents

1.  [Problem](#problem)
2.  [Solution Overview](#solution-overview)
3.  [Core Features](#core-features)
4.  [Technologies Used](#technologies-used)
5.  [System Architecture](#system-architecture)
6.  [Demo Links & Resources](#demo-links--resources)
7.  [Project Setup](#project-setup)
8.  [Deploying to ICP Mainnet](#deploying-to-icp-mainnet)
9.  [Project Structure](#project-structure)
10. [Roadmap](#roadmap)
11. [Community & Contribution](#community--contribution)
12. [Deployment Team](#deployment-team)
13. [License](#license)

---

## Problem

As autonomous AI agents proliferate, they rely on a decentralized network of specialized servers (MCPs) to perform their work. But this creates a fundamental problem: **how can an agent, or its owner, trust a third-party server?** How can we be sure it's secure, reliable, and won't manipulate data or poison AI models? This lack of a unified trust layer fragments the AI economy and hinders its growth.

---

## Solution Overview

**Prometheus Protocol** is the open-source trust layer for the decentralized AI economy on the Internet Computer. We provide a seamless, on-chain experience for **identity, verifiable trust, and programmable payments**—empowering users, agents, and developers to participate in an open, secure machine-to-machine economy.

[![Watch the Pitch Deck Video](https://i.ytimg.com/vi/4YvL-2Jt0I0/hqdefault.jpg)](https://www.youtube.com/watch?v=4YvL-2Jt0I0)

---

## Core Features

| Feature | Description               |
| ------- | ------------------------- | --------------------------------------------------------------------- |
| 🛡️      | Secure On-Chain OAuth 2.1 | Production-grade identity and authorization for any service.          |
| 🔎      | Verifiable App Store      | Certified discovery, audit trails, and cryptographic code provenance. |
| 💸      | ICRC-2 Allowance Payments | Direct, programmable, and low-fee token payments for M2M commerce.    |
| 🤖      | Agent-Ready APIs          | Built from the ground up for both humans and autonomous agents.       |
| 🏆      | Open-Source SDKs          | Motoko & TypeScript SDKs for rapid integration and development.       |

---

## Technologies Used

- **Protocol:** Internet Computer Protocol (ICP), Model Context Protocol (MCP)
- **Canisters:** Motoko
- **Standards:** ICRC-1/2 (Tokens), ICRC-118 (Versioning), ICRC-120 (Orchestration), ICRC-126 (Attestation), ICRC-127 (Bounties)
- **Identity:** Internet Identity V2, On-Chain OAuth 2.1 with PKCE, Dynamic Client Registration
- **IC Features:** t-ECDSA, Certified Responses, Timers
- **Frontend:** React, TypeScript, Vite
- **Testing:** PicJS: `test:canisters`, Vitest: `test:mo`

---

## System Architecture

The protocol is a vertically integrated stack where each layer builds upon the last, ensuring a secure and seamless flow from user identity to service execution.

### Protocol Architecture

![Protocol Architecture](design/images/protocol-architecture.png)

### Canister Architecture

![Canister Architecture](design/images/canister-architecture.png)

---

## Demo Links & Resources

- **Live App Store:** [Discover and inspect verified services](https://gyeil-qyaaa-aaaai-q32uq-cai.icp0.io/)
- **Video Pitch Deck:** [Watch our Vision & Architecture Overview](https://www.youtube.com/watch?v=4YvL-2Jt0I0)
- **Design Document:** [View our UX/UI Research & Design System](design/README.md)
- **OAuth 2.1 Dashboard:** [Manage clients and grants for the payment protocol](https://bmfnl-jqaaa-aaaai-q32ha-cai.icp0.io/)

---

## Project Setup

### Requirements

- Node.js >= 18.x.x
- [DFINITY SDK (`dfx`)](https://internetcomputer.org/docs/current/developer-docs/quickstart/local-quickstart)
- [pnpm](https://pnpm.io/installation) (for monorepo management)
- [Mops](https://mops.one/) (Motoko Package Manager)

### Installation Guide

1.  **Clone the repository**
    ```bash
    git clone https://github.com/prometheus-protocol/prometheus-protocol.git
    cd prometheus-protocol
    ```
2.  **Install dependencies**
    ```bash
    pnpm install
    mops install
    ```
3.  **Start local ICP replica**
    ```bash
    dfx start --clean --background
    ```
4.  **Deploy canisters locally**
    ```bash
    dfx deploy
    ```
5.  **Run the App Store frontend**
    ```bash
    pnpm --filter @prometheus-protocol/frontend dev
    ```

---

## Deploying to ICP Mainnet

1.  **Log in with your mainnet identity:**
    ```bash
    dfx identity use <your-mainnet-identity>
    ```
2.  **Deploy all canisters:**
    ```bash
    dfx deploy --network=ic
    ```

**Mainnet Canister IDs:**

- **App Store UI:** `gyeil-qyaaa-aaaai-q32uq-cai`
- **MCP Registry:** `grhdx-gqaaa-aaaai-q32va-cai`
- **MCP Orchestrator:** `ez54s-uqaaa-aaaai-q32za-cai`
- **Auditor Credentials:** `eq6xo-cyaaa-aaaai-q32yq-cai`
- **OAuth Server:** `bfggx-7yaaa-aaaai-q32gq-cai`
- **OAuth Frontend:** `bmfnl-jqaaa-aaaai-q32ha-cai`
- **ICRC1 Ledger (PMP):** `dy3i7-mqaaa-aaaai-q32ja-cai`

---

## Project Structure

```
/design            # UX Research, UI Mockups, and Design System
/packages
  /apps            # User-facing applications
    /cli           # The Prometheus CLI (`prom-cli`)
    /frontend      # The App Store web UI (React)
  /canisters       # Motoko source for all on-chain services
  /libs            # Shared libraries and SDKs
    /ic-js         # TypeScript SDK for web/off-chain integration
/scripts           # Utility and deployment scripts
```

---

## Roadmap

Our journey is structured in ambitious phases, building from a solid foundation towards a vibrant, trusted ecosystem.

<details>
  <summary><strong>Phase 0: The Foundation (✅ COMPLETE)</strong></summary>
  <p><strong>Goal:</strong> Forge the complete, end-to-end stack for secure identity and payments.</p>
  <ul>
    <li><strong>[x] The Core Auth Server:</strong> Implemented the core OAuth 2.1 flows, JWT signing, and modern security standards.</li>
    <li><strong>[x] The Developer SDKs:</strong> Released <code>motoko-mcp-sdk</code> and <code>@prometheus-protocol/typescript-sdk</code> for building and integrating monetizable services.</li>
    <li><strong>[x] The Proof of Concept:</strong> Deployed live demos showcasing the full identity and payment stack.</li>
  </ul>
</details>

<details>
  <summary><strong>Phase 1: The Trust Layer (⏳ NEARING COMPLETION)</strong></summary>
  <p><strong>Goal:</strong> Build the premier, high-trust software supply chain for provably safe services, establishing the gold standard for reliability in the agent economy.</p>
  <ul>
    <li><strong>[x] The On-Chain Supply Chain Hub:</strong> Deployed the <code>mcp_registry</code> (ICRC-118/126/127) and <code>mcp_orchestrator</code> (ICRC-120).</li>
    <li><strong>[x] The Developer & Auditor Tooling:</strong> Developed and shipped the complete <code>@prometheus-protocol/cli</code>.</li>
    <li><strong>[x] The App Store Frontend:</strong> Deployed a user-friendly web interface for discovering services and viewing their on-chain certification status.</li>
    <li><strong>[x] The Governance & Audit Workflow:</strong> Implemented the full on-chain workflow for Developers, Auditors, and the DAO.</li>
    <li><strong>[ ] DAO Formation & Onboarding:</strong> Formally constitute the governing DAO and onboard the initial set of trusted auditors.</li>
    <li><strong>[ ] Security Hardening:</strong> Submit the entire canister suite for a professional, third-party security audit.</li>
  </ul>
</details>

<details>
  <summary><strong>Phase 2: Ecosystem Growth (🚀 UP NEXT)</strong></summary>
  <p><strong>Goal:</strong> With a unified platform for trust, identity, and payments, the focus shifts to scaling the ecosystem through strategic onboarding and partnerships.</p>
  <ul>
    <li><strong>[ ] Onboard the First Wave of Production Services:</strong> Actively recruit and support high-value developers to publish their services on the platform.</li>
    <li><strong>[ ] Drive Client-Side Integration:</strong> Partner with developers of AI agents and MCP clients to integrate the registry as a primary, high-trust service source.</li>
    <li><strong>[ ] Accelerate Community Adoption:</strong> Launch community initiatives such as hackathons, developer grants, and comprehensive tutorials.</li>
  </ul>
</details>

<details>
  <summary><strong>Phase 3: The Autonomous Economy</strong></summary>
  <p><strong>Goal:</strong> Evolve from a platform managed by the founding team into a self-sustaining, community-governed economic protocol.</p>
  <ul>
    <li><strong>[ ] Full Decentralization & Curation:</strong> Transition full control of the Registry Hub and its policies to the DAO, cementing its status as a decentralized public utility.</li>
    <li><strong>[ ] Advanced Economic Primitives:</strong> Enable security bonds and atomic, on-chain revenue sharing for services.</li>
  </ul>
</details>

---

## Community & Contribution

Prometheus is a fully open-source project, and we welcome contributions of all kinds.

- ⭐ **Star the repo:** The easiest way to show your support!
- 💬 **Join the conversation:** [Join our Discord server](https://discord.gg/TbqgYERjYw) to chat with the team and community.
- 🐞 **Report bugs:** Find a bug? Open an issue in the [Issues tab](https://github.com/prometheus-protocol/prometheus-protocol/issues).
- 💡 **Suggest features:** Have an idea? Start a discussion in the [Discussions tab](https://github.com/prometheus-protocol/prometheus-protocol/discussions).
- ✍️ **Contribute code:** Check out our [Contribution Guidelines](CONTRIBUTING.md) to get started.

---

## Deployment Team

- **Roblynn** — Project Manager
- **Jesse** — Lead Developer
- **Hannah** — UX/UI Designer

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
