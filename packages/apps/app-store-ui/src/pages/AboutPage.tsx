import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import { DISCORD_LINK, GITHUB_LINK } from '@/lib/const';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# About Prometheus Protocol

## Building the Trust Layer for the Open Agentic Web

The coming AI agent economy will either be a series of closed **"walled gardens"** or an open, innovative **"web of agents."** Our mission is to build the trust layer that makes the open web possible.

### The Challenge in the Emerging AI Ecosystem

As autonomous AI agents become more prevalent, they need to connect to a universe of specialized services to perform their tasks. This creates a new frontier of digital risk.

In an open "Web of Agents," how can an agent—or its owner—trust that a third-party service is secure, reliable, and won't manipulate its data? Without a foundational trust layer, the agent economy defaults to a chaotic, unsafe ecosystem or becomes locked down in centralized "walled gardens."

### Our Solution: A Verification Protocol for AI Infrastructure

Prometheus Protocol is the solution: a fully transparent, trustless "app store" for the open agentic economy. Unlike traditional systems that rely on a central company for approval (the "walled garden" model), our protocol uses a transparent, on-chain process governed by cryptographic proofs and economic incentives to establish verifiable trust.

Before a new version of a service can be published, it must pass a series of mandatory, community-driven audits. This entire lifecycle is built on open standards, ensuring the process is auditable by anyone.

### An Open Protocol, Not a Walled Garden

Prometheus Protocol is not a company; it is a public good. We are building open-source, credibly neutral infrastructure that no single entity can control. Our commitment is to the open "Web of Agents," not to building our own "walled garden."

The protocol's rules are encoded in open-source smart contracts, and its development is transparent and community-driven on GitHub.

### Join the Mission

Whether you're building the next great AI agent or providing the infrastructure that powers them, you are a vital part of this ecosystem.

-   **For Agent Builders & Users:** [Explore our registry of trusted services](/). Find reliable, secure infrastructure for your AI agents and make safer, more informed connections.
-   **For Service Developers:** [Learn how to submit your service for verification](https://docs.prometheusprotocol.org/guides/service-devs/overview). Showcase the quality of your infrastructure and earn the trust of the entire agent ecosystem.
-   **For Everyone:** Become a part of the conversation. Join our community on [Discord](${DISCORD_LINK}) and follow our progress on [GitHub](${GITHUB_LINK}).

Together, we can build a safer, more transparent foundation for the open agentic web.
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
