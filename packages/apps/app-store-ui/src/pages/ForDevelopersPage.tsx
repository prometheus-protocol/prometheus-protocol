import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
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

## How It Works: The Path to Certification

Our process is designed to be transparent and straightforward.

### 1. Prepare Your Server
Ensure your server is stable, well-documented, and has a publicly accessible source code repository (e.g., on GitHub). Review our audit standards to understand the criteria we evaluate.
> **[Read the full Audit Standards & Preparation Guide](/docs/audit-standards)**

### 2. Submit for Audit
Use our platform to submit your server for certification. You will need to provide your repository URL, the specific commit hash you want audited, and any relevant documentation.
> **[Go to the Submission Portal](/submit)**

### 3. The Community Audit
Once submitted, your server enters the audit queue. A certified auditor from the community will be assigned to conduct a thorough review based on our public standards. The process is tracked transparently.

### 4. Receive Your Certificate
Upon successful completion of the audit, your server is awarded a Certificate with a corresponding score. This Certificate is published on-chain and your server is listed in our official registry with its new, trusted status.

## Ready to Get Started?

Join the growing ecosystem of trusted AI infrastructure. Take the first step by reviewing our documentation or submitting your server today.

-   **Questions?** **[Join our Discord](https://discord.gg/TbqgYERjYw)** and connect with the community.
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
