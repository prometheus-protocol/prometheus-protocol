<p align="center">
  <a href="https://github.com/prometheus-protocol/prometheus-protocol">
    <img alt="prometheus-banner" src="https://github.com/user-attachments/assets/0e0cc899-def2-42dc-a365-a34512f280ba" />
  </a>
</p>

<p align="right">
  <i>If you find this project useful, please star it ✨</i>
</p>

---

<h2 align="center">Prometheus Protocol Monorepo</h2>
<p align="center">🏛️ <b>The Foundational Infrastructure for the Open Agentic Web.</b></p>

---

<p align="center">
  <b>Please note that this project is under active development. APIs might change before version 1 is released.</b>
</p>

<p align="center"><a href="https://github.com/prometheus-protocol/prometheus-protocol/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>&nbsp;<a href="https://www.npmjs.com/package/@prometheus-protocol/cli"><img alt="NPM Version" src="https://img.shields.io/npm/v/@prometheus-protocol/cli.svg"/></a>&nbsp;<a href="https://github.com/prometheus-protocol/prometheus-protocol/actions/workflows/tests.yml"><img alt="Tests" src="https://github.com/prometheus-protocol/prometheus-protocol/actions/workflows/ci.yml/badge.svg" /></a>&nbsp;<a href="https://discord.gg/TbqgYERjYw"><img alt="Join our Discord" src="https://dcbadge.limes.pink/api/server/https://discord.gg/TbqgYERjYw?style=flat"/></a>&nbsp;<a href="https://github.com/prometheus-protocol/prometheus-protocol"><img alt="Version" src="https://img.shields.io/github/package-json/v/prometheus-protocol/prometheus-protocol"/></a></p>

## Project Summary

Prometheus Protocol is the open-source infrastructure for the decentralized AI economy. We provide the essential on-chain foundation for **verifiable trust, secure identity, and programmable payments** to ensure the future is an open "Web of Agents," not a series of closed "walled gardens." Our full-stack solution includes a verifiable App Store, an on-chain OAuth 2.1 identity provider, and a complete developer toolchain with a CLI and SDKs.

## Table of Contents

1.  [Problem](#problem)
2.  [Solution Overview](#solution-overview)
3.  [Key Progress & Achievements](#key-progress--achievements)
4.  [Core Features](#core-features)
5.  [Economic Model & Sustainability](#economic-model--sustainability)
6.  [Technologies & ICP Features Used](#technologies--icp-features-used)
7.  [System Architecture](#system-architecture)
8.  [Demo Links & Resources](#demo-links--resources)
9.  [Project Setup](#project-setup)
10. [Testing](#testing)
11. [Deploying to ICP Mainnet](#deploying-to-icp-mainnet)
12. [Challenges & Learnings](#challenges--learnings)
13. [Roadmap](#roadmap)
14. [Deployment Team](#deployment-team)
15. [License](#license)

---

## Problem

The agentic economy faces a critical choice: will it be a series of closed, corporate **"walled gardens,"** or an open, innovative **"web of agents"?**

An open web is impossible without solving the fundamental problem of trust. Without a unified trust layer, the ecosystem defaults to two bad outcomes: a chaotic, unsafe free-for-all, or a lockdown into centralized platforms that stifle competition and extract value.

---

## Solution Overview

**Prometheus Protocol** provides the solution by creating a transparent, on-chain "app store" for the open agentic web, governed by cryptographic proofs and economic incentives. We provide the trust that makes the open economy possible.

[![Watch our E2E Demo Video](https://i.ytimg.com/vi/ZK6Zo2tWfSQ/hqdefault.jpg)](https://www.youtube.com/watch?v=ZK6Zo2tWfSQ)

[![Watch our Pitch Video](https://i.ytimg.com/vi/639_-z_Oq8E/hqdefault.jpg)](https://www.youtube.com/watch?v=639_-z_Oq8E)

---

## Key Progress & Achievements

We have moved at an accelerated pace to build not just the technical primitives, but the entire economic and social ecosystem required for an open agentic web to thrive.

- **Launched a Complete Economic Engine:**
  - **Usage Mining System:** A full-stack system for developers to reward end-users with USDC for interacting with their services, driving a powerful economic feedback loop.
  - **Public Bounty & Grant Infrastructure:** A live bounty board with over 1,000 USDC in initial bounties to fund the creation of new services, plus a Genesis Grant Program for larger projects.
- **Forged a Robust Trust Layer:**
  - **Auditor Hub & Reputation System:** A dedicated hub where vetted auditors can stake USDC to claim audit bounties from a public queue and build their on-chain reputation.
  - **Automated & Social Integration:** A complete auditor onboarding process with real-time Discord bot notifications for new service submissions.
- **Driven Real-World Adoption:**
  - **Multi-Platform Agent Integration:** Proved end-to-end functionality by creating AI agents that consume Prometheus-verified services using diverse clients, including **n8n, PortalOne, and VSCode.**
  - **Official Documentation & Community:** Launched comprehensive documentation and a new "On-chain AI" tech meetup to accelerate developer onboarding and community growth.

---

## Core Features

|     | Feature                   | Description                                                               |
| :-: | ------------------------- | ------------------------------------------------------------------------- |
| 🛡️  | Secure On-Chain OAuth 2.1 | Production-grade identity and authorization for any service.              |
| 🔎  | Verifiable App Store      | A decentralized software supply chain with on-chain audits & code proofs. |
| 💸  | Direct Token Payments     | Programmable, low-fee payments for a true M2M economy.                    |
| 🤖  | Agent-Ready APIs          | Built from the ground up for both humans and autonomous agents.           |
| 🏆  | Open-Source SDKs          | Motoko & TypeScript SDKs for rapid integration and development.           |

---

## Economic Model & Sustainability

Our protocol is designed as a self-sustaining economic flywheel for the open agentic web.

1.  **Enabling Monetization (The Foundation):** Our OAuth 2.1 server provides the essential tools for any developer to monetize their AI services with on-chain micropayments.
2.  **Driving Discovery & Trust (The Marketplace):** The App Store is the public marketplace where users and agents discover these monetized services. The Prometheus Certificate acts as a powerful signal of quality and security, reducing friction and encouraging user adoption. **Trust is the lubricant for economic activity.**
3.  **Protocol Sustainability:** The long-term sustainability of the protocol will be ensured by its core utility. In the future, a micro-fee on transactions can be introduced via a transparent, community-vetted process. These funds would flow to a protocol-managed treasury to fund ongoing development, security audits, and ecosystem grants, ensuring Prometheus remains a well-maintained public good.

---

## Technologies & ICP Features Used

- **Protocol:** Internet Computer Protocol (ICP)
- **Canisters:** Motoko
- **Standards:** ICRC-1/2 (Tokens), ICRC-118 (Versioning), ICRC-120 (Orchestration), ICRC-126 (Attestation), ICRC-127 (Bounties)
- **Identity:** Internet Identity, On-Chain OAuth 2.1 with PKCE
- **Advanced IC Features:** **t-ECDSA** (for JWT signing), **Certified Responses**, **Timers**
- **Frontend:** React, TypeScript, Vite
- **Testing:** `picjs` (powered by PocketIC), Vitest

---

## System Architecture

The protocol is a vertically integrated stack where each layer builds upon the last, ensuring a secure and seamless flow from user identity to service execution.

![Protocol Architecture](design/images/protocol-architecture.png)

![Canister Architecture](design/images/canister-architecture.png)

---

## Demo Links & Resources

- **Live App Store:** [Discover Verified MCP Servers](https://prometheusprotocol.org)
- **Documentation:** [Read the Docs](https://docs.prometheusprotocol.org)
- **Marketing and User Research:** [View our Marketing and User Research](marketing/README.md)
- **Design Document:** [View our UX/UI Research & Design System](design/README.md)
- **OAuth 2.1 Dashboard:** [Manage Clients and Grants](https://bmfnl-jqaaa-aaaai-q32ha-cai.icp0.io/)

- **Video Pitch & Demo:** [Watch our Vision, Architecture Overview, and Code Walkthrough](https://www.youtube.com/watch?v=639_-z_Oq8E)
- **Full Functional Demo:** [Watch our Full Functional Demo](https://www.youtube.com/watch?v=ZK6Zo2tWfSQ)

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

## Testing

The project includes a comprehensive test suite to ensure reliability and correctness.

- **E2E & Integration Tests (`picjs`):** We use `picjs`, powered by **PocketIC**, to run end-to-end tests that simulate real-world interactions between all canisters.
  ```bash
  pnpm test:canisters
  ```
- **Unit Tests (Motoko):** Core business logic within individual canisters is verified with `mo:test`.
  ```bash
  mops test
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
- **Auditor Hub:** `eq6xo-cyaaa-aaaai-q32yq-cai`
- **App Bounties:** `jld6p-yqaaa-aaaai-q33ra-cai`
- **Usage Tracker:** `m63pw-fqaaa-aaaai-q33pa-cai`
- **Leaderboard:** `jmcy3-viaaa-aaaai-q33rq-cai`
- **OAuth Server:** `bfggx-7yaaa-aaaai-q32gq-cai`
- **OAuth Frontend:** `bmfnl-jqaaa-aaaai-q32ha-cai`
- **ICRC1 Ledger (PMP):** `dy3i7-mqaaa-aaaai-q32ja-cai`

---

## Challenges & Learnings

Building a full-stack, on-chain trust layer presented several unique challenges:

1.  **On-Chain OAuth 2.1 Security:** Implementing a secure OAuth server on a public blockchain required leveraging mandatory PKCE, certified responses, and a unique `request_id` system to protect against code interception and malicious boundary nodes.
2.  **ICRC Standard Composability:** Integrating five different ICRC standards into a cohesive system was a significant architectural challenge, requiring careful state management and inter-canister communication patterns.
3.  **CLI Tooling & Build Process:** Creating a professional CLI required solving complex build issues, particularly managing ESM/CJS module compatibility, which we solved using `esbuild`.

---

## Roadmap

Our journey is structured in ambitious phases, building from a solid foundation towards a vibrant, trusted ecosystem.

<details>
  <summary><strong>Phase 0: The Foundation (✅ COMPLETE)</strong></summary>
  <p><strong>Goal:</strong> Forge the complete, end-to-end stack for secure identity and payments.</p>
  <ul>
    <li><strong>[x]</strong> Deployed a production-ready OAuth 2.1 provider and a full suite of SDKs, enabling any developer to build and monetize secure, on-chain services.</li>
  </ul>
</details>

<details>
  <summary><strong>Phase 1: The Trust Layer (✅ COMPLETE)</strong></summary>
  <p><strong>Goal:</strong> Build the premier, high-trust software supply chain for provably safe services.</p>
  <ul>
    <li><strong>[x]</strong> Shipped a feature-complete, on-chain App Store and Trust Hub, including a service registry, an audit and bounty marketplace, and a full command-line interface for developers and auditors.</li>
  </ul>
</details>

<details>
  <summary><strong>Phase 2: Ecosystem Growth (✅ COMPLETE)</strong></summary>
  <p><strong>Goal:</strong> Build the complete economic and social infrastructure to bootstrap a self-sustaining economy via the <strong>Alpha Flywheel Initiative</strong>.</p>
  <ul>
    <li><strong>[x]</strong> Launched a full suite of incentive systems: a developer bounty board, a Genesis Grant program, an Auditor Hub with staking and reputation, and a "Usage Mining" system to reward end-users with USDC.</li>
  </ul>
</details>

<details>
  <summary><strong>Phase 3: The Professional Marketplace (🚀 UP NEXT)</strong></summary>
  <p><strong>Goal:</strong> Evolve from a foundational protocol into a professional, scalable, and accessible marketplace ready for widespread adoption.</p>
  <ul>
    <li><strong>[ ] Professionalizing the Marketplace:</strong> Establish clear SOPs for auditors, and implement a robust cycles monitoring and top-up system for service reliability.</li>
    <li><strong>[ ] Expanding the Economy:</strong> Enhance the Motoko SDK with programmatic charging and integrate ETH wallet support with 1-click USDC bridging to lower the barrier for new users.</li>
    <li><strong>[ ] Scaling Developer Adoption:</strong> Achieve full feature parity for the Rust MCP SDK and integrate with the official MCP registry to maximize discoverability.</li>
    <li><strong>[ ] Accelerating Community Growth:</strong> Scale our community engagement through targeted outreach, tech meetups, and a steady stream of high-quality tutorials and guides.</li>
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
