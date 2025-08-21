import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Terms of Service

**Last Updated:** August 17, 2025

These Terms of Service ("Terms") govern your use of the Prometheus Protocol (the "Protocol"), a decentralized software protocol for managing and monetizing MCP servers.

The Protocol is developed and maintained by its community of users and developers (the "Prometheus DAO"). The **Prometheus Foundation** (the "Foundation," "we," "us"), a company registered in the British Virgin Islands, is a non-profit entity that supports the growth and development of the Protocol as directed by the Prometheus DAO.

By using the Protocol, you agree to be bound by these Terms. This constitutes a legal agreement between you and the Prometheus Foundation.

## 1. The Protocol, Not a Service

You acknowledge that the Protocol is a decentralized, autonomous piece of software. The Foundation facilitates access to the Protocol, but it does not control user interactions or the content of Servers published on it. Transactions you engage in are peer-to-peer and managed by the blockchain.

## 2. The Role of the Prometheus DAO

The Prometheus DAO is the governing body of the Protocol. Key parameters, protocol upgrades, and changes to these Terms are subject to proposals and voting by the members of the DAO. The Foundation's role is to implement the outcomes of successful governance votes where legally and technically feasible.

## 3. The Verification Process and Certificates

The Protocol includes a verification process to audit Servers. You acknowledge that:

-   A Certificate represents a point-in-time analysis and is not a continuous endorsement or guarantee of security.
-   The verification process is provided "AS IS." Neither the Foundation nor the DAO is liable for any errors or omissions in an audit.
-   Users are solely responsible for their decision to use any Server, regardless of its certification status.

## 4. Disclaimers and Limitation of Liability

THE PROTOCOL IS PROVIDED "AS IS" AND "AS AVAILABLE." IN NO EVENT WILL THE PROMETHEUS FOUNDATION, ITS DIRECTORS, OR EMPLOYEES BE LIABLE FOR DAMAGES OF ANY KIND. FURTHERMORE, YOU ACKNOWLEDGE THAT NO INDIVIDUAL MEMBER OF THE PROMETHEUS DAO BEARS INDIVIDUAL LIABILITY FOR THE OPERATION OF THE PROTOCOL. YOUR SOLE RECOURSE FOR ANY DISPUTE IS WITH THE PROMETHEUS FOUNDATION, LIMITED TO THE FULLEST EXTENT PERMITTED BY LAW.

## 5. Changes to the Terms

Changes to these Terms may be proposed by the community and must be ratified by a formal governance vote of the Prometheus DAO. Upon a successful vote, the Foundation will update these Terms, and the "Last Updated" date will be revised. Your continued use of the Protocol after such changes constitutes your acceptance of the new Terms.

## 6. Governing Law and Jurisdiction

These Terms and any dispute or claim arising out of or in connection with them shall be governed by and construed in accordance with the laws of the **British Virgin Islands**. Any legal suit or proceeding shall be instituted exclusively in the courts of the **British Virgin Islands**.

## 7. Contact

For legal notices or inquiries regarding these Terms, please contact the **Prometheus Foundation** at: [legal@prometheusprotocol.com](mailto:legal@prometheusprotocol.com).
`;

export function TermsOfServicePage() {
  return (
    <ContentPageLayout>
      <ReactMarkdown
        // --- 2. Pass the markdown string to the component ---
        components={{
          // --- 3. (Optional but powerful) Override default HTML elements ---
          // This ensures internal links use React Router for SPA navigation,
          // while external links (http, mailto) work normally.
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
