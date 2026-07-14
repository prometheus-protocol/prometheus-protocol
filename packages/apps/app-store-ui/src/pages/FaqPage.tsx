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

### What do the trust labels mean?
Prometheus does not provide a blanket guarantee. Labels describe what has been verified for a specific canister version.

-   **Developer Managed:** BYOC/self-managed canister. The developer controls the canister, code, upgrades, and operations. Prometheus has not verified or audited it.
-   **Verified Build:** The developer submitted open-source code, and the decentralized verifier network rebuilt it in hermetic Docker environments. The resulting WASM hash matched the on-chain WASM.
-   **Audited Verified Code:** The verified code has also passed a point-in-time security audit. This is the future highest tier and is not a continuous guarantee.
-   **Unverified:** No reproducible-build proof or audit is available. Use with caution.

### Is an "Audited Verified Code" service guaranteed to be 100% safe?
No. Verification proves source/build correspondence, and an audit is a point-in-time review of a specific version. Neither is a continuous guarantee, insurance policy, or endorsement. Always exercise caution and do your own research.

### What should I do if I find a security issue in a certified service?
Please report it to the service's development team immediately. We also ask that you confidentially report the issue to the Prometheus Protocol team at **[security@prometheusprotocol.org](mailto:security@prometheusprotocol.org)** so we can review the service's certification status.

---

## For Developers

### How do I submit my service for certification?
The process is straightforward. You can find a step-by-step guide on our [Service Developer Docs](https://docs.prometheusprotocol.org/guides/service-devs/overview). You will need a public source code repository (like GitHub) and to follow our preparation guide.

### How much does verification or audit cost?
Build verification is performed by the decentralized verifier network. Security audits of verified code are a separate, higher-assurance step and will have their own process once fully implemented.

### How long does verification take?
Build verification usually completes once enough verifier nodes independently reproduce the same WASM hash. Future security audits will vary by code complexity and queue size.

### What happens if my service fails verification or audit?
If build verification fails, the submitted source and build instructions do not reproduce the deployed WASM hash. Fix the source, build environment, or deployment and resubmit. Future audit failures can be addressed and resubmitted after remediation.

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
