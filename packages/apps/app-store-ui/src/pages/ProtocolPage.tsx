import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import { DISCORD_LINK, GITHUB_LINK } from '@/lib/const';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# The Prometheus Protocol Architecture

This document provides a detailed technical overview of the Prometheus Protocol's architecture and the end-to-end lifecycle for certifying a new application version.

## Overview: The Trustless App Store

Our system is a decentralized application registry. Unlike traditional app stores that rely on a central party, our system uses a transparent, on-chain process governed by cryptographic proofs, economic incentives, and decentralized identity. The system ensures that before a new version of an application can be published, it must pass a series of mandatory, community-driven audits.

---

## The Core Components

Our system is a composition of several powerful ICRC standards, each playing a distinct role:

-   **MCP Registry (The App Store):** The host canister that orchestrates the entire process.
-   **ICRC-118 (WASM Management):** The underlying "shelf" where application namespaces (\`CanisterType\`) and their version histories are stored.
-   **ICRC-120 (Canister Orchestration):** The "canister manager" that handles canister commands, ensuring only verified WASM is deployed.
-   **ICRC-126 (Verification & Auditing):** The immutable logbook for verification requests and audit "attestations".
-   **ICRC-127 (Bounty System):** The economic engine for funding and paying out audit bounties.
-   **Auditor Credentials Canister:** The identity layer for issuing credentials to trusted auditors.
-   **ICRC-1/2 Ledger:** The token infrastructure for funding and paying out bounties.

---

## The Complete End-to-End Lifecycle

This is the full, orchestrated flow that our E2E test now successfully validates:

1.  **Setup:** The DAO issues credentials to a group of specialized auditors.
2.  **Submission:** A Developer creates a namespace for their app.
3.  **Verification Request:** The Developer proposes a new WASM for verification by submitting its hash and repo URL.
4.  **Incentivization:** A Sponsor creates and funds three distinct bounties for each required audit type (\`repro_build\`, \`security\`, \`quality\`). The registry pulls the funds into escrow.
5.  **The Work:** The three credentialed auditors see the bounties and each performs their specific audit.
6.  **Proof of Work:** Each auditor files their attestation on-chain using \`icrc126_file_attestation\`.
7.  **Payout:** Each auditor claims their respective bounty using \`icrc127_submit_bounty\`. The registry validates each claim against the corresponding attestation and pays out automatically.
8.  **Governance:** The DAO observes that all three required attestations for the WASM are now complete.
9.  **Finalization:** The DAO calls \`finalize_verification\` to officially mark the WASM hash as trusted.
10. **Publication:** The Developer, seeing the WASM is now finalized, successfully calls \`icrc118_update_wasm\`. The registry's internal hook checks \`is_wasm_verified\`, sees it is \`true\`, and allows the WASM to be published.


---

## What's Next?

Understanding the architecture is the first step. Here’s how you can get more involved and put this knowledge into action.

### For Developers
Ready to build? Our developer portal provides the practical steps for getting your MCP server certified.
> **[Read the Developer Guide](/developers)**

### For Auditors & Community Members
Have questions or want to get involved in the auditing process? Our Discord is the hub for all technical and community discussions.
> **[Join the Community on Discord](${DISCORD_LINK})**

### Explore the Source Code
The ultimate source of truth is the code itself. Dive into our repositories to see how it all works.
> **[View the Protocol on GitHub](${GITHUB_LINK})**
`;

export function ProtocolPage() {
  return (
    <ContentPageLayout>
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => {
            if (props.href && props.href.startsWith('/')) {
              return <Link to={props.href} {...props} />;
            }
            return <a target="_blank" rel="noopener noreferrer" {...props} />;
          },
        }}>
        {markdownContent}
      </ReactMarkdown>
    </ContentPageLayout>
  );
}
