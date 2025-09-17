import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Privacy Policy

**Last Updated:** September 17, 2025

**IMPORTANT: PLEASE READ THIS POLICY CAREFULLY. THIS IS NOT A SUBSTITUTE FOR PROFESSIONAL LEGAL ADVICE.**

This Privacy Policy describes how information is collected and used in connection with the Prometheus Protocol (the "Protocol") and its public web interfaces.

The Protocol is a decentralized, open-source public good. This policy clarifies the distinction between data that is inherently public on the blockchain and data that may be collected by the user-facing web interfaces maintained by the community.

## 1. Information We Collect

### A. Information You Provide

-   **Authentication:** The Protocol's authentication system uses Internet Identity, which provides a pseudonymous **Principal ID** for your account. We do not collect or store traditional personal information like emails or passwords for authentication.
-   **Communications:** If you contact the community maintainers (e.g., via email or Discord), we will have access to your contact information and the content of your message.

### B. Information Collected Automatically by the Web Interface

-   **Usage and Analytics Data:** To improve the public web interface to the Protocol, we may collect standard analytics data, such as your IP address, browser type, and pages visited. This data is used in aggregate to understand usage patterns and is not tied to your Principal ID.

### C. Information from Public Blockchains

-   **On-Chain Data is Public:** Your Principal ID and any on-chain interactions you perform with the Protocol are, by their nature, public and permanent information on the Internet Computer blockchain. We do not control this information; it is part of the public ledger.

## 2. How We Use Your Information

Information collected is used for the following purposes:

-   To provide and maintain a user-friendly interface to the Protocol;
-   To communicate with you for support or community engagement purposes;
-   To monitor and analyze usage to improve the user experience of the public web interface;
-   To ensure the security and integrity of the web interface.

## 3. Data Controller and Your Rights

**There is no central data controller for the Prometheus Protocol.**

-   **On-Chain Data:** You are in control of your on-chain data. Your interactions with the blockchain are self-directed.
-   **Off-Chain Data (Analytics):** For data collected by the web interface, you can use browser-based tools (such as ad blockers, cookie managers, or VPNs) to limit or prevent the collection of this information.

Because of the decentralized nature of the Protocol, traditional data rights (like the right to erasure) may not apply to public blockchain data, which is immutable.

## 4. Contact Us

If you have any questions about this Privacy Policy, please contact the community maintainers:

-   By email: [privacy@prometheusprotocol.org](mailto:privacy@prometheusprotocol.org)
`;

export function PrivacyPolicyPage() {
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
