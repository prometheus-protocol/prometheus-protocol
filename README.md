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
<p align="center">🏛️ <b>The Trust Layer for the Open Agentic Web.</b></p>

---

<p align="center">
  <b>Please note that this project is under active development. APIs might change before version 1 is released.</b>
</p>

<p align="center"><a href="https://github.com/prometheus-protocol/prometheus-protocol/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>&nbsp;<a href="https://www.npmjs.com/package/@prometheus-protocol/app-store-cli"><img alt="NPM Version" src="https://img.shields.io/npm/v/@prometheus-protocol/app-store-cli"/></a>&nbsp;<a href="https://github.com/prometheus-protocol/prometheus-protocol/actions/workflows/tests.yml"><img alt="Tests" src="https://github.com/prometheus-protocol/prometheus-protocol/actions/workflows/ci.yml/badge.svg" /></a>&nbsp;<a href="https://discord.gg/TbqgYERjYw"><img alt="Join our Discord" src="https://dcbadge.limes.pink/api/server/https://discord.gg/TbqgYERjYw?style=flat"/></a>&nbsp;<a href="https://github.com/prometheus-protocol/prometheus-protocol"></a></p>

## Project Summary

Prometheus Protocol provides the three essentials for the open agentic web: a secure **Passport** (identity), a functional **Bank Account** (DeFi), and a trusted **Marketplace** (discovery). We believe the future of the web will be run by AI agents, and in this hackathon, we built the entire foundational layer to make that happen.

## Table of Contents

1.  [The Problem: Agents are Trapped](#the-problem-agents-are-trapped)
2.  [The Solution: A Passport, a Bank Account, and a Marketplace](#the-solution-a-passport-a-bank-account-and-a-marketplace)
3.  [The Proof: We Built It All](#the-proof-we-didnt-just-design-this-we-built-it-all-of-it)
4.  [Quick Links & Demos](#quick-links--demos)
5.  [Getting Started](#getting-started)
6.  [System Architecture](#system-architecture)
7.  [Core Components & Canisters](#core-components--canisters)
8.  [The Completed Hackathon Journey](#the-completed-hackathon-journey)
9.  [Community & Contribution](#community--contribution)
10. [License](#license)

---

## The Problem: Agents are Trapped

AI agents are incredibly powerful. They can reason, plan, and execute complex tasks. But right now, they're trapped.

On the open web, an agent is **blind and broke**. It can't prove who it is, it can't trust who it's talking to, and it has no way to pay for services on-chain. This is the single biggest blocker to a true, open agentic economy, leaving the door open for a future of closed, corporate "walled gardens."

---

## The Solution: A Passport, a Bank Account, and a Marketplace

**Prometheus Protocol sets them free.** We give every agent three simple things: a secure **Passport**, an on-chain **Bank Account**, and a trusted **Marketplace**.

- **Our Identity Layer is the Passport**, letting agents prove who they are.
- **Our Payments Layer is the Bank Account**, for frictionless, on-chain transactions.
- **Our App Store is the trusted marketplace** where they can find and use audited services.

It’s the complete trust stack for AI agents to finally interact with the world.

---

## We Didn't Just Design This. We Built It. All of It.

That's a big vision. But we're a team that executes. We didn't just build a feature. We built and shipped a live, end-to-end ecosystem from scratch during this hackathon.

#### 1. We Built the Passport (The Identity Layer)

We forged the identity layer for the entire ecosystem: a production-ready, on-chain **OAuth 2.1 provider**, compliant with the latest MCP specification. This is the universal key that unlocks the open agentic web.

#### 2. We Built the App Store (The Marketplace)

We launched the trusted marketplace where agents discover and connect to services. This is a complete, high-trust software supply chain, including:

- A feature-complete, **on-chain App Store** and service registry.
- An **Auditor Hub & Reputation System** where vetted auditors stake USDC to claim audit bounties.
- A full **command-line interface (CLI)** for developers and auditors.

#### 3. We Built the Bank Account (The Agentic Money Layer)

Finally, we built the most critical piece: the financial tools that make an agent's bank account powerful. We didn't stop at an empty marketplace. We built a **complete suite of agent-operable DeFi primitives**, including:

- **Core Wallet Primitives:** Deployed **`Easy Wallet`** and **`Synapse Fund`** for agents to manage allowances, transfer tokens, and operate secure on-chain wallets.
- **Decentralized Exchanges:** Launched **`KongSwap DEX`** and **`Transcendence DEX`** to provide multiple venues for agents to execute token swaps and access market data.
- **Market Intelligence:** Created **`Token Watchlist`** and **`RateStream`** to provide on-chain oracles and registries for agents to discover assets and get real-time price information.
- **Earning & Speculation:** Built **`Final Score`**, a complete on-chain prediction market, allowing agents to deploy capital and generate returns.

---

## Quick Links & Demos

- **Live Marketplace:** [Discover, verify, and manage agent allowances](https://prometheusprotocol.org/)
- **Documentation:** [Read the Docs](https://docs.prometheusprotocol.org)
- **Pitch Deck Video:** [Watch our Vision & Architecture Overview](https://youtu.be/W2JADKBXTJA)
- **Functional Demo:** [Watch the Full Protocol in Action](https://youtu.be/pZuS0EZ8Inw)

---

## Getting Started

### Requirements

- Node.js >= 18.x.x
- [DFINITY SDK (`dfx`)](https://internetcomputer.org/docs/current/developer-docs/quickstart/local-quickstart)
- [pnpm](https://pnpm.io/installation) (for monorepo management)
- [Mops](https://mops.one/) (Motoko Package Manager)

### Quick Start

1.  **Clone and install**

    ```bash
    git clone https://github.com/prometheus-protocol/prometheus-protocol.git
    cd prometheus-protocol
    pnpm install
    mops install
    ```

2.  **Deploy locally**

    ```bash
    # Start dfx with Docker networking enabled
    dfx start --host 0.0.0.0:4943 --domain localhost --domain host.docker.internal --clean --background
    
    # Deploy all canisters
    dfx deploy
    ```

3.  **Configure canisters**

    ```bash
    # Automatically link all canister dependencies
    pnpm config:inject

    # Set up local dev environment (test tokens, cycles, etc.)
    pnpm setup:local
    ```

4.  **Start verifier bots (optional)**

    ```bash
    # Register 6 dev verifier accounts with API keys and stakes
    pnpm exec tsx scripts/register-dev-verifiers.ts
    
    # Generate .env file for docker-compose
    pnpm exec tsx scripts/generate-verifier-env.ts
    
    # Start verifier bots in Docker
    cd packages/apps/verifier-bot/deployment
    docker-compose up -d
    
    # View logs
    docker-compose logs -f
    ```

5.  **Run the frontend**
    ```bash
    pnpm --filter @prometheus-protocol/frontend dev
    ```

📖 **See [QUICKSTART.md](./QUICKSTART.md) for detailed instructions and troubleshooting.**

### Production Deployment

```bash
# Deploy to IC mainnet
dfx deploy --network ic

# Auto-configure all dependencies
pnpm config:inject -- --network ic

# Verify configuration
pnpm config:check -- --network ic
```

📖 **See [docs/PRODUCTION_DEPLOYMENT.md](./docs/PRODUCTION_DEPLOYMENT.md) for the complete production guide.**

---

## System Architecture

The protocol is a vertically integrated stack where each layer builds upon the last, ensuring a secure and seamless flow from user identity to service execution.

![Protocol Architecture](design/images/protocol-architecture.png)

![Canister Architecture](design/images/canister-architecture.png)

---

## Core Components & Canisters

Our work is extensive and spans multiple repositories and on-chain services.

#### Core Protocol

| Component             | Repository                                                                   | Mainnet Canister ID           |
| --------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| **Marketplace UI**    | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `gyeil-qyaaa-aaaai-q32uq-cai` |
| **MCP Registry**      | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `grhdx-gqaaa-aaaai-q32va-cai` |
| **MCP Orchestrator**  | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `ez54s-uqaaa-aaaai-q32za-cai` |
| **Auditor Hub**       | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `eq6xo-cyaaa-aaaai-q32yq-cai` |
| **App Bounties**      | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `jld6p-yqaaa-aaaai-q33ra-cai` |
| **Usage Tracker**     | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `m63pw-fqaaa-aaaai-q33pa-cai` |
| **Leaderboard**       | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `jmcy3-viaaa-aaaai-q33rq-cai` |
| **OAuth Server**      | [View Source](https://github.com/prometheus-protocol/prometheus-protocol)    | `bfggx-7yaaa-aaaai-q32gq-cai` |
| **Motoko MCP SDK**    | [View Repo](https://github.com/prometheus-protocol/motoko-sdk)               | N/A                           |
| **Create MCP Server** | [View Repo](https://github.com/prometheus-protocol/create-motoko-mcp-server) | N/A                           |

#### Agentic DeFi Primitives (MCP Servers)

| Component             | Repository                                                                                                             | Mainnet Canister ID           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Token Watchlist**   | [View Source](https://github.com/prometheus-protocol/prometheus-protocol/tree/main/packages/canisters/token_watchlist) | `ljntu-eaaaa-aaaai-q34bq-cai` |
| **KongSwap DEX**      | [View Repo](https://github.com/jneums/arcswap)                                                                         | `lr7wt-gaaaa-aaaai-q336a-cai` |
| **Easy Wallet**       | [View Repo](https://github.com/jneums/easy-wallet)                                                                     | `l4kcz-fiaaa-aaaai-q34ca-cai` |
| **Final Score**       | [View Repo](https://github.com/jneums/final-score)                                                                     | `ilyol-uqaaa-aaaai-q34kq-cai` |
| **Synapse Fund**      | [View Repo](https://github.com/jneums/synapse-fund)                                                                    | `ln3mc-raaaa-aaaai-q334a-cai` |
| **Transcendence DEX** | [View Repo](https://github.com/jneums/transcendence)                                                                   | `ic3fx-cyaaa-aaaai-q34la-cai` |
| **CycleOps Buddy**    | [View Repo](https://github.com/jneums/cycle-buddy)                                                                     | `imzi7-ziaaa-aaaai-q34ka-cai` |
| **RateStream**        | [View Repo](https://github.com/jneums/ratestream)                                                                      | `k3quj-eqaaa-aaaai-q33za-cai` |

---

## The Completed Hackathon Journey

Our roadmap was a logical progression from foundation to a fully operational economy. We are proud to have delivered on every phase.

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
  <p><strong>Goal:</strong> Build the complete economic and social infrastructure to bootstrap a self-sustaining economy.</p>
  <ul>
    <li><strong>[x]</strong> Launched a full suite of incentive systems: a developer bounty board, a Genesis Grant program, an Auditor Hub with staking and reputation, and a "Usage Mining" system to reward end-users with USDC.</li>
  </ul>
</details>

<details>
  <summary><strong>Phase 3: The Agentic Money Layer (✅ COMPLETE)</strong></summary>
  <p><strong>Goal:</strong> Evolve from a foundational protocol into a professional, scalable, and accessible marketplace ready for widespread adoption.</p>
  <ul>
    <li><strong>[x] Professionalizing the Marketplace:</strong> Established clear SOPs for auditors, and implemented a robust cycles monitoring and top-up system for service reliability.</li>
    <li><strong>[x] Expanding the Economy:</strong> Enhanced the Motoko SDK with programmatic charging and built a full suite of Agentic DeFi primitives (DEXs, Wallets, Oracles).</li>
    <li><strong>[x] Scaling Developer Adoption:</strong> Integrated with the official MCP registry to maximize discoverability.</li>
    <li><strong>[x] Accelerating Community Growth:</strong> Scaled our community engagement through targeted outreach, tech meetups, and a steady stream of high-quality tutorials and guides.</li>
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

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
