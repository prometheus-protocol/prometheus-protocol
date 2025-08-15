import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Logo } from '../Logo';

// Link data arrays remain the same
const protocolLinks = [
  { href: '/gift-cards', label: 'Gift Cards' },
  { href: '/redeem', label: 'Redeem' },
  { href: '/refund-policy', label: 'Refund Policy', badge: 'BETA' },
];

const resourcesLinks = [
  { href: '/docs/review-agent', label: 'How to become a review agent' },
  { href: '/help', label: 'Help Center' },
  { href: '/newsletter', label: 'Prometheus Newsletter' },
  { href: '/blog', label: 'Blog' },
  { href: '/request-demo', label: 'Request a Demo' },
];

export function Footer() {
  return (
    <footer className="border-t bg-background px-4 sm:px-6 lg:px-8 relative">
      {/* The top glow line remains the same */}
      <div
        className="
          bg-yellow-400/40
          absolute top-0 left-0 w-full h-px
        "
      />
      <div className="container py-12 mx-auto">
        {/* --- Top section with link columns --- */}
        {/* 1. SIMPLIFIED THE GRID AND SET CUSTOM COLUMN SIZES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-24 border-b pb-12">
          {/* Logo Column (will now be twice as wide as the others on desktop) */}
          <div>
            <Logo className="mb-6 h-18 -mt-3" />
            <p className="text-sm text-muted-foreground mb-4 max-w-3xs">
              Prometheus Protocol is a decentralized platform for managing and
              monetizing MCP servers.
            </p>
          </div>
          {/* Protocol Links Column */}
          <div>
            <h3 className="font-semibold tracking-tight text-foreground mb-4">
              Prometheus Protocol
            </h3>
            <ul className="space-y-3">
              {protocolLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center gap-2">
                    {link.label}
                    {link.badge && (
                      <Badge variant="secondary">{link.badge}</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* Resources Links Column */}
          <div>
            <h3 className="font-semibold tracking-tight text-foreground mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              {resourcesLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* --- Bottom section with language selector --- */}
        {/* 2. FIXED THE JUSTIFY AND MADE IT RESPONSIVE */}
        <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Prometheus Protocol. All rights
            reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img
              src="https://flagcdn.com/us.svg"
              alt="United States Flag"
              className="w-5 h-5 rounded-full"
            />
            <span>United States (English (United States))</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
