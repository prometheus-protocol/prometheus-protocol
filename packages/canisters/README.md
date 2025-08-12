### **Prometheus Protocol: The Trustless App Store Lifecycle**

#### **Overview**

We have successfully architected and implemented the core backend logic for a decentralized application registry. Unlike traditional app stores that rely on a central party (like Apple or Google) to approve software, our system uses a transparent, on-chain process governed by cryptographic proofs, economic incentives, and decentralized identity.

The system ensures that before a new version of an application can be published and made available to users, it must pass a series of mandatory, community-driven audits. This process is fully transparent, automated, and auditable by anyone.

#### **The Core Components**

Our system is a composition of several powerful ICRC standards, each playing a distinct role:

- **MCP Registry (The App Store):** The host canister that orchestrates the entire process. It's the central hub where developers, auditors, and the DAO interact.
- **ICRC-118 (WASM Management):** The underlying "shelf" where application namespaces (`CanisterType`) and their version histories are stored.
- **ICRC-120 (Canister Orchestration):** The "canister manager" that handles the canister commands, ensuring that only verified WASM canisters are deployed.
- **ICRC-126 (Verification & Auditing):** The immutable logbook. It records requests for verification and the resulting "attestations" (audit reports) filed by auditors.
- **ICRC-127 (Bounty System):** The economic engine. It allows anyone to fund bounties that pay out automatically when a specific on-chain condition (like a successful audit) is met.
- **Auditor Credentials Canister:** The identity layer. It issues credentials to trusted auditors, ensuring that only qualified parties can perform specific types of audits.
- **ICRC-1/2 Ledger:** The bank. It provides the token infrastructure for funding and paying out bounties.

---

### **User Flows: The Personas of the App Store**

Our system serves several key user roles, each with a distinct workflow:

#### **1. The Developer**

- **Goal:** To securely publish a new, trusted version of their application.
- **Flow:**
  1.  **`icrc118_create_canister_type`**: The developer first registers a unique "namespace" for their application (e.g., `com.my-company.my-cool-app`). This is a one-time setup.
  2.  **`icrc126_verification_request`**: To release a new version, the developer submits the WASM hash and source code repository for verification. **Crucially, the WASM is not yet published.** This action creates a public record that a new version is seeking approval.
  3.  **`icrc118_update_wasm`**: After the WASM has passed all audits and been finalized by the DAO, the developer can now successfully publish the WASM, officially adding it to their application's version history. The system will only permit this final step if the WASM is verified.

#### **2. The Auditor (Bounty Hunter)**

- **Goal:** To use their expertise to audit software and earn rewards.
- **Flow:**
  1.  **Discover Bounties:** The auditor queries the registry's `icrc127_list_bounties` endpoint to find open bounties for audits they are qualified to perform (e.g., "security audit for wasm_hash `0x123...`").
  2.  **Perform the Audit:** They conduct their analysis off-chain, examining the source code and build process.
  3.  **`icrc126_file_attestation`**: They submit their findings as a cryptographic "attestation" to the registry. This is their proof of work, permanently recorded on-chain.
  4.  **`icrc127_submit_bounty`**: They submit a claim for the corresponding bounty. The registry's internal logic automatically checks that the required attestation has been filed. If it has, the bounty is paid out instantly from the escrowed funds.

#### **3. The DAO / Sponsor**

- **Goal:** To ensure the health and security of the ecosystem by funding audits and governing the final approval process.
- **Flow:**
  1.  **`issue_credential`**: The DAO vets and issues credentials to trusted auditors via the Auditor Credentials Canister.
  2.  **`icrc127_create_bounty`**: To incentivize the auditing of a new WASM, the DAO (or any interested party) creates and funds bounties for required audits (e.g., Reproducible Build, Security, Code Quality). The funds are locked in escrow on the registry canister.
  3.  **`finalize_verification`**: After all required attestations have been filed and reviewed, the DAO gives its final seal of approval by calling this function. This is the ultimate gate that marks a WASM as officially "Verified" and ready for publication.

---

### **The Complete End-to-End Lifecycle**

This is the full, orchestrated flow that our E2E test now successfully validates:

1.  **Setup:** The DAO issues credentials to a group of specialized auditors.
2.  **Submission:** A Developer creates a namespace for their app.
3.  **Verification Request:** The Developer proposes a new WASM for verification by submitting its hash and repo URL.
4.  **Incentivization:** A Sponsor creates three distinct bounties, one for each required audit type (`repro_build`, `security`, `quality`), and funds them with tokens. The registry pulls the funds into escrow.
5.  **The Work:** The three credentialed auditors see the bounties. Each performs their specific audit.
6.  **Proof of Work:** Each auditor files their attestation on-chain using `icrc126_file_attestation`.
7.  **Payout:** Each auditor claims their respective bounty using `icrc127_submit_bounty`. The registry validates each claim against the corresponding attestation and pays out automatically.
8.  **Governance:** The DAO observes that all three required attestations for the WASM are now complete.
9.  **Finalization:** The DAO calls `finalize_verification` to officially mark the WASM hash as trusted.
10. **Publication:** The Developer, seeing the WASM is now finalized, successfully calls `icrc118_update_wasm`. The registry's internal hook checks `is_wasm_verified`, sees it is `true`, and allows the WASM to be published, making it available to the `mcp_orchestrator` for deployment.
