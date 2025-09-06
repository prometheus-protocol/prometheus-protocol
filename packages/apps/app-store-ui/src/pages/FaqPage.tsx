import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Frequently Asked Questions

Have a question? We've compiled a list of the most common ones below.

---

## General Questions

### What is Prometheus Protocol?
Prometheus Protocol is a decentralized discovery and verification platform for **Model Context Protocol (MCP) servers**. Our mission is to create a transparent and trustworthy ecosystem for the infrastructure that powers the next generation of AI agents.

### What is an MCP Server?
A Model Context Protocol (MCP) server is a specialized server that provides AI agents with access to models, context, and tools. It's a crucial piece of infrastructure that allows agents to perform complex tasks. You can learn more on our [About page](/about).

### Why is a verification protocol necessary?
As AI agents become more autonomous, the servers they connect to pose a significant security risk. An untrustworthy server could manipulate data, poison models, or compromise the agent's tasks. Our verification process provides a layer of trust and security, allowing users and agents to connect to third-party servers with confidence.

### Is Prometheus Protocol a company?
No. The protocol is a decentralized public good, governed by the **Prometheus DAO**. It is supported by the **Prometheus Foundation**, a non-profit entity that acts as the legal and administrative steward for the DAO.

---

## For Users & Agent Builders

### What do the certification tiers (Gold, Silver, Bronze) mean?
The tiers represent the score a server received during its audit.
-   **Gold (90-100):** Outstanding. The server demonstrates exceptional security, code quality, and adherence to best practices.
-   **Silver (75-89):** Solid. The server meets all key security and performance criteria with a good overall score.
-   **Bronze (60-74):** Verified. The server meets all essential criteria for security and reliability.
-   **Community Tier:** This server has been submitted by the community but has **not yet been audited** by the protocol. Use with caution.

### Is a "Gold Verified" server guaranteed to be 100% safe?
No. A certificate is a point-in-time analysis of a specific version of the server's code. It represents a high standard of quality and security at the time of the audit, but it is not a continuous guarantee or an endorsement. The world of security is constantly evolving. Always exercise caution and do your own research.

### What should I do if I find a security issue in a certified server?
Please report it to the server's development team immediately. We also ask that you confidentially report the issue to the Prometheus Foundation at **[security@prometheusprotocol.org](mailto:security@prometheusprotocol.org)** so we can review the server's certification status.

---

## For Developers

### How do I submit my MCP server for certification?
The process is straightforward. You can find a step-by-step guide on our [Server Developer Docs](https://docs.prometheusprotocol.org/guides/service-devs/overview). You will need a public source code repository (like GitHub) and to follow our preparation guide.

### How much does an audit cost?
During our initial launch phase, audits are subsidized by the Prometheus Foundation and are free for qualifying open-source projects. In the future, the Prometheus DAO will establish a fee structure to sustainably fund community auditors.

### How long does the audit process take?
The timeline can vary depending on the complexity of your server and the current queue of submissions. We aim for a turnaround time of 1-2 weeks, but this is not guaranteed. The process is tracked transparently.

### What happens if my server fails the audit?
Failing an audit is not the end of the road. You will receive a private report detailing the issues found. You can address these issues and resubmit your server for a new audit once you are ready.

### My question isn't here. Where can I get help?
Our community is the best place to ask! Join our **[Discord Server](https://discord.gg/your-invite-link)** to connect with the team and other developers.
`;

export function FaqPage() {
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
