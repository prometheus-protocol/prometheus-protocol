import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# About Prometheus Protocol

## Building the Trust Layer for Decentralized AI

Our mission is to create a transparent, trustworthy, and decentralized ecosystem for **Model Context Protocol (MCP) servers**—the essential backbone for the next generation of autonomous AI agents.

### The Challenge in the Emerging AI Ecosystem

As autonomous AI agents become more prevalent, the infrastructure they rely on is critically important. These agents need to connect to specialized servers to access context, resources, and tools to perform their tasks.

But this creates a new frontier of digital risk. How can an agent—or its owner—trust that a third-party server is secure, reliable, and won't manipulate its data or poison its model? How can developers of these vital servers prove their quality and safety?

### Our Solution: A Verification Protocol for AI Infrastructure

Prometheus Protocol is the solution: a decentralized discovery and verification layer built specifically for **MCP servers**. We provide the tools and standards to bring clarity and confidence to the AI agent ecosystem.

-   **Verifiable Audits for MCP Servers:** We facilitate rigorous, transparent, and standardized audits of MCP server code. Our process checks for security vulnerabilities, data integrity, code quality, and adherence to protocol standards.
-   **On-Chain Certificates:** When a server passes an audit, it receives a "Certificate" that is recorded immutably on the blockchain. This acts as a verifiable, tamper-proof seal of quality that any agent or user can inspect before making a connection.
-   **A Curated Discovery Registry:** Our platform allows users and their AI agents to safely explore and connect to servers, filtering by their certification tier. This empowers the entire ecosystem to make informed decisions based on verifiable data.

### Governed by the Community

Prometheus Protocol is not a traditional company; it is a public good, governed by the **Prometheus DAO**. The direction, rules, and future of the protocol are decided by its community members through a transparent, on-chain governance process.

The **Prometheus Foundation**, a non-profit entity based in the British Virgin Islands, acts as the legal and administrative steward for the DAO. Its sole purpose is to support the community and execute the will of the DAO, ensuring the protocol remains decentralized and true to its mission.

### Join the Mission

Whether you're building the next great AI agent or providing the infrastructure that powers them, you are a vital part of this ecosystem.

-   **For Agent Builders & Users:** [Explore our registry of certified MCP servers](/). Find reliable, secure infrastructure for your AI agents and make safer, more informed connections.
-   **For Server Developers:** [Learn how to submit your MCP server for certification](/developers). Showcase the quality of your AI infrastructure and earn the trust of the entire agent ecosystem.
--   **For Everyone:** Become a part of the conversation. Join our community on [Discord](https://discord.gg/TbqgYERjYw) and follow our progress on [GitHub](https://github.com/prometheus-protocol).

Together, we can build a safer, more transparent foundation for decentralized AI.
`;

export function AboutPage() {
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
