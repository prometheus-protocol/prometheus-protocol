import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import { DISCORD_LINK } from '@/lib/const';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Frequently Asked Questions

Have a question? We've compiled a list of the most common ones below.

---

## General Questions

### What is Prometheus Protocol?
Prometheus Protocol is a decentralized discovery and verification platform for the **open agentic economy**. Our mission is to provide the foundational trust layer that allows a vibrant "Web of Agents" to thrive, as an alternative to centralized "walled gardens."

### What is an "Agentic Service"?
An "agentic service" is any specialized, on-chain application that an AI agent can connect to for tools, data, or capabilities. This could be anything from a data provider to a complex computational tool. Prometheus helps agents discover and trust these services.

### Why is a verification protocol necessary?
As AI agents become more autonomous, the services they connect to pose a significant security risk. Without a reliable way to verify their quality and safety, the agent economy faces two bad outcomes: a chaotic, unsafe free-for-all, or a lockdown into centralized "walled gardens" controlled by a few large companies. Our verification protocol provides the trust needed for an open, innovative, and safe ecosystem to exist.

---

## For Users & Agent Builders

### What do the certification tiers (Gold, Silver, Bronze) mean?
The tiers are not based on a subjective score, but on a series of concrete, verifiable achievements. The foundation of all tiers is a **Verified Build**, which cryptographically proves that the code running on-chain is the exact same as the public source code.

-   **Gold:** **Verified Build + Audited App Info + Audited Tools + Audited Data Safety.** This is the highest level of trust, indicating the service has passed rigorous checks on its code, its description, its external integrations, and its data privacy practices.
-   **Silver:** **Verified Build + Audited App Info + Audited Tools.** This tier verifies the code and its external dependencies, making it a strong choice for most use cases.
-   **Bronze:** **Verified Build + Audited App Info.** This is the baseline for trust. It proves the code is authentic and the developer's description of the service is accurate.
-   **Unranked:** This service has been submitted but has **not yet passed the minimum requirements for a Bronze tier** (i.e., a verified build). Use with extreme caution.

### Is a "Gold Verified" service guaranteed to be 100% safe?
No. A certificate is a point-in-time analysis of a specific version of the service's code. It represents a high standard of quality and security at the time of the audit, but it is not a continuous guarantee or an endorsement. The world of security is constantly evolving. Always exercise caution and do your own research.

### What should I do if I find a security issue in a certified service?
Please report it to the service's development team immediately. We also ask that you confidentially report the issue to the Prometheus Protocol team at **[security@prometheusprotocol.org](mailto:security@prometheusprotocol.org)** so we can review the service's certification status.

---

## For Developers

### How do I submit my service for certification?
The process is straightforward. You can find a step-by-step guide on our [Service Developer Docs](https://docs.prometheusprotocol.org/guides/service-devs/overview). You will need a public source code repository (like GitHub) and to follow our preparation guide.

### How much does an audit cost?
During our initial launch phase, audits are subsidized by the protocol and are free for qualifying open-source projects. In the future, the protocol will establish a sustainable fee structure to fund community auditors.

### How long does the audit process take?
The timeline can vary depending on the complexity of your service and the current queue of submissions. We aim for a turnaround time of 1-2 weeks, but this is not guaranteed. The process is tracked transparently.

### What happens if my service fails the audit?
Failing an audit is not the end of the road. You will receive a private report detailing the issues found. You can address these issues and resubmit your service for a new audit once you are ready.

### My question isn't here. Where can I get help?
Our community is the best place to ask! Join our **[Discord Server](${DISCORD_LINK})** to connect with the team and other developers.
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
