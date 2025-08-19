import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import { DISCORD_LINK } from '@/lib/const';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Get in Touch

We're building a transparent and community-driven ecosystem, and we'd love to hear from you. To make sure your message gets to the right place, please choose from the options below.

## Community & Support

**For most questions, our Discord server is the best place to get a fast response.**

It's the heart of the Prometheus community, where you can connect with other developers, get help with your server submission, and participate in the conversation about the future of the protocol.

-   **[Join our Discord Server](${DISCORD_LINK})**

## Official Inquiries

For formal, private, or sensitive matters, please contact the Prometheus Foundation using the appropriate email address below.

### General & Partnerships
For general questions about the Foundation or to discuss potential partnerships.
> **[contact@prometheusprotocol.org](mailto:contact@prometheusprotocol.org)**

### Press & Media
For media inquiries, interviews, or other press-related matters.
> **[press@prometheusprotocol.org](mailto:press@prometheusprotocol.org)**

### Security Vulnerabilities
To report a security issue or vulnerability in the protocol or our platform, please contact us privately. **Please do not post security issues in public channels.**
> **[security@prometheusprotocol.org](mailto:security@prometheusprotocol.org)**
`;

export function ContactPage() {
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
