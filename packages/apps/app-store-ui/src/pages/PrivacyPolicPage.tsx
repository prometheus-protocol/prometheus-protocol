import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Privacy Policy

**Last Updated:** August 17, 2025

This Privacy Policy describes how information is collected and used in connection with the Prometheus Protocol (the "Protocol").

The **Prometheus Foundation** (the "Foundation," "we," "us"), a company registered in the British Virgin Islands, acts as the primary steward for the data processed in relation to the user-facing interfaces it provides for the Protocol. For the purposes of data protection laws like GDPR, the **Prometheus Foundation is the data controller.**

## 1. Information We Collect

### A. Information You Provide

-   **Authentication:** We use Internet Identity, which provides a pseudonymous **Principal ID** for your account. We do not collect traditional personal information like emails or passwords for authentication.
-   **Communications:** If you contact the Foundation, we will collect your contact information and the content of your message.

### B. Information Collected Automatically

-   **Usage and Analytics Data:** To improve the interface to the Protocol, we may collect standard analytics data, such as your IP address, browser type, and pages visited.

### C. Information from Public Blockchains

-   Your Principal ID and any on-chain interactions are public information on the Internet Computer blockchain.

## 2. How We Use Your Information

The Foundation uses the information it collects to:

-   Provide and maintain a user-friendly interface to the Protocol;
-   Communicate with you for support purposes;
-   Monitor and analyze usage to improve the user experience;
-   Fulfill legal and regulatory obligations.

## 3. Data Controller and Your Rights

The Prometheus Foundation is the data controller for the information described in this policy. Depending on your location, you may have rights to access, rectify, or erase your personal data held by the Foundation. To exercise these rights, please contact us.

## 4. Contact Us

If you have any questions about this Privacy Policy, please contact the **Prometheus Foundation**:

-   By email: [privacy@prometheusprotocol.com](mailto:privacy@prometheusprotocol.com)
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
            return <a {...props} />;
          },
        }}>
        {markdownContent}
      </ReactMarkdown>
    </ContentPageLayout>
  );
}
