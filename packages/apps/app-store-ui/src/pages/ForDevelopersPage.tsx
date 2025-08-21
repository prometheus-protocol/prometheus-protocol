import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import { DISCORD_LINK } from '@/lib/const';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Get Your MCP Server Certified

In the new world of autonomous AI agents, trust is the most valuable asset. Prometheus Protocol provides the framework for you to prove the quality and security of your Model Context Protocol (MCP) server, making it a trusted cornerstone of the decentralized AI ecosystem.

## Why Certify Your Server?

Getting your MCP server certified by the Prometheus DAO is more than just a security check; it's a powerful signal to the entire community.

-   **Gain Instant Trust & Adoption:** A Prometheus Certificate is a verifiable, on-chain credential that proves your server meets high standards for security and reliability. Users and their agents are far more likely to connect to a certified server.
-   **Increase Visibility & Discovery:** Certified servers are featured prominently on our platform, putting your project in front of a targeted audience of AI developers and agent builders actively looking for reliable infrastructure.
-   **Receive a Rigorous Third-Party Audit:** Our standardized audit process provides you with a comprehensive review of your code, identifying potential vulnerabilities and areas for improvement. It's a valuable security health check for your project.
-   **Strengthen the Ecosystem:** By participating, you contribute to a safer, more transparent, and more reliable foundation for decentralized AI, benefiting everyone.

## How It Works: The App Store Lifecycle

Our system is a transparent, on-chain process serving several key roles. Here’s how you fit in.

### 1. The Developer Flow

**Your Goal:** To securely publish a new, trusted version of your application.

1.  **Register Namespace:** First, you register a unique "namespace" for your application (e.g., \`com.my-company.my-cool-app\`). This is a one-time setup using \`icrc118_create_canister_type\`.
2.  **Request Verification:** To release a new version, you submit its WASM hash and source code repository for verification using \`icrc126_verification_request\`. **Crucially, the WASM is not yet published.** This creates a public record that a new version is seeking approval.
3.  **Publish WASM:** After the WASM has passed all required audits and been finalized by the DAO, you can successfully publish it with \`icrc118_update_wasm\`. The protocol will only permit this final step if the WASM is verified.

### 2. The Auditor Flow (Bounty Hunter)

**Your Goal:** To use your expertise to audit software and earn rewards.

1.  **Discover Bounties:** Query the registry's \`icrc127_list_bounties\` endpoint to find open bounties for audits you are qualified to perform.
2.  **Perform Audit:** Conduct your analysis off-chain, examining the source code and build process.
3.  **File Attestation:** Submit your findings as a cryptographic "attestation" to the registry using \`icrc126_file_attestation\`. This is your on-chain proof of work.
4.  **Claim Bounty:** Submit a claim for the bounty with \`icrc127_submit_bounty\`. The protocol automatically validates your attestation and pays out the reward instantly.

### 3. The DAO / Sponsor Flow

**Your Goal:** To ensure the health of the ecosystem by funding audits and governing the final approval.

1.  **Issue Credentials:** The DAO vets and issues credentials to trusted auditors.
2.  **Create Bounties:** To incentivize audits, the DAO (or any sponsor) creates and funds bounties for required audits (e.g., Reproducible Build, Security) using \`icrc127_create_bounty\`.
3.  **Finalize Verification:** After all required attestations are filed, the DAO gives its final seal of approval by calling \`finalize_verification\`. This is the ultimate gate that marks a WASM as officially "Verified" and ready for publication.

> **For a complete, end-to-end technical walkthrough, [see the full protocol lifecycle](/protocol).**

## Ready to Get Started?

Join the growing ecosystem of trusted AI infrastructure. Take the first step by reviewing our documentation or submitting your server today.

-   **Questions?** **[Join our Discord](${DISCORD_LINK})** and connect with the community.
`;

export function ForDevelopersPage() {
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
