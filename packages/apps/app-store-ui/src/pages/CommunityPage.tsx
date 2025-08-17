import { ContentPageLayout } from '@/components/layout/ContentPageLayout';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';

const markdownContent = `
# Our Strength is Our Community

Prometheus Protocol is more than just code; it's a movement. We are a collective of builders, auditors, AI enthusiasts, and visionaries dedicated to creating a transparent and trustworthy foundation for decentralized AI. Our community is the heart of the protocol—it's where ideas are born, code is built, and the future is decided.

## Join the Conversation: Our Discord Server

The single best place to connect with the Prometheus ecosystem is on our Discord server. It's our community's town hall, support desk, and development hub all in one.

> **[Click here to join the Prometheus Protocol Discord Server](https://discord.gg/your-invite-link)**

When you join, you'll be able to:
-   **Get Support:** Ask questions and get help from the community and the core team.
-   **Share Ideas:** Propose new features and give feedback on the protocol's direction.
-   **Meet the Ecosystem:** Connect with other MCP server developers and AI agent builders.
-   **Stay Updated:** Be the first to know about new announcements and developments.

---

## How You Can Contribute

There are many ways to get involved, no matter your skill set.

### For Everyone
-   **Participate in Discussions:** Your voice matters. Join the conversation on Discord, share your perspective, and help shape the future of the protocol.
-   **Spread the Word:** Believe in our mission? Tell your friends, colleagues, and followers about Prometheus Protocol. Share our announcements and help us grow the community.
-   **Follow Us:** Stay connected with our progress on [GitHub](https://github.com/your-repo) and other social platforms.

### For Developers & Builders
-   **Submit Your MCP Server:** The most direct way to contribute is to build and [submit your MCP server for certification](/developers). Help us grow the registry of trusted AI infrastructure.
-   **Contribute to the Codebase:** The protocol itself is open source. Check out our repositories on GitHub, review code, report issues, and contribute with pull requests.
-   **Help Others:** Share your expertise in our developer support channels on Discord. Helping others is a powerful way to strengthen the entire ecosystem.

### For Governance Participants
-   **Shape the Future:** As a DAO, the protocol's direction is decided by its members. Participate in governance discussions on Discord, review community proposals, and (eventually) use your voice to vote on the future of Prometheus Protocol.

## Our Community Principles

We are committed to maintaining a welcoming, collaborative, and respectful environment. All community members are expected to adhere to our code of conduct, which is based on a few simple principles:
-   **Be Respectful:** Engage in constructive, considerate dialogue.
-   **Be Collaborative:** We are building this together. Share knowledge and help others succeed.
-   **Be Transparent:** Operate with honesty and openness.

You can read our full guidelines in the \`#rules\` channel on our Discord server.

---

The future of decentralized AI is being built today, by all of us. **Let's build it together.**
`;

export function CommunityPage() {
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
