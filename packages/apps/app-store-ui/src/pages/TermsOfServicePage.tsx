import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Terms of Use

**Last Updated:** September 17, 2025

**IMPORTANT: PLEASE READ THESE TERMS CAREFULLY. THIS IS NOT A SUBSTITUTE FOR PROFESSIONAL LEGAL ADVICE.**

These Terms of Use ("Terms") govern your access to and use of the Prometheus Protocol (the "Protocol"), a decentralized, open-source software protocol for the discovery and verification of agentic services.

The Protocol is a public good, developed and maintained by a distributed community of contributors. There is no central company, foundation, or DAO that controls the Protocol. By using the Protocol, you agree to be bound by these Terms.

## 1. The Protocol is Public Infrastructure

You acknowledge that the Protocol is a decentralized, autonomous software that runs on a public blockchain. The public interfaces to the Protocol are provided for your convenience, but we (the Protocol's maintainers and contributors) do not control user interactions or the content of services published on it. All transactions you engage in are peer-to-peer and are your own responsibility.

## 2. Governance and Development

The Protocol is open-source. The direction, rules, and future of the Protocol are managed through a transparent, public development process on platforms like GitHub. There is no formal, on-chain governance body.

## 3. The Verification Process and Certificates

The Protocol includes a verification process to audit services. You acknowledge and agree that:

-   A Certificate represents a point-in-time analysis of a specific version of a service's code and is not a continuous endorsement or guarantee of security, quality, or fitness for any purpose.
-   The verification process is provided "AS IS." Neither the Protocol's maintainers nor its community contributors are liable for any errors, omissions, or the outcome of any audit.
-   You are solely responsible for your decision to use any service, regardless of its certification status. Always conduct your own research.

## 4. Disclaimers and Limitation of Liability

THE PROTOCOL AND ALL RELATED SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND.

IN NO EVENT WILL THE PROTOCOL'S MAINTAINERS, CONTRIBUTORS, OR ANY AFFILIATED PARTIES BE LIABLE FOR DAMAGES OF ANY KIND, INCLUDING DIRECT, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF, OR INABILITY TO USE, THE PROTOCOL.

YOU ACKNOWLEDGE THAT NO INDIVIDUAL CONTRIBUTOR BEARS INDIVIDUAL LIABILITY FOR THE OPERATION OF THE PROTOCOL.

## 5. Changes to the Terms

We may update these Terms from time to time. When we do, we will revise the "Last Updated" date at the top of this page. Your continued use of the Protocol after such changes constitutes your acceptance of the new Terms. We encourage you to review these Terms periodically.

## 6. Contact

For inquiries regarding these Terms, you can reach out to the community maintainers at: [contact@prometheusprotocol.org](mailto:contact@prometheusprotocol.org).
`;

export function TermsOfServicePage() {
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
