import { Link } from 'react-router-dom';
import { Logo } from '../Logo';

// Link data arrays remain the same
const protocolLinks = [
  { href: '/about', label: 'About Us' },
  { href: '/developers', label: 'For Developers' },
  { href: '/github', label: 'GitHub' },
];

const resourcesLinks = [
  { href: '/contact', label: 'Contact Us' },
  { href: '/faq', label: 'FAQ' },
  { href: '/community', label: 'Community' },
];

const legalLinks = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
];

export function Footer() {
  return (
    <footer className="border-t bg-background px-6 lg:px-8 relative">
      {/* The top glow line remains the same */}
      <div
        className="
          bg-primary/60
          absolute top-0 left-0 w-full h-px
        "
      />
      <div className="container pt-16 pb-8 mx-auto">
        {/* --- Top section with link columns --- */}
        {/* 1. SIMPLIFIED THE GRID AND SET CUSTOM COLUMN SIZES */}
        <div className="grid grid-cols-1 md:grid-cols-9 gap-12 md:gap-24 border-b pb-12">
          {/* Logo Column (will now be twice as wide as the others on desktop) */}
          <div className="col-span-3 flex flex-col items-start">
            <Logo className="mb-6 h-18 -mt-3" />
            <p className="text-sm text-muted-foreground mb-4 max-w-3xs">
              A decentralized platform for managing and monetizing MCP servers.
            </p>
          </div>
          {/* Protocol Links Column */}
          <div className="col-span-2">
            <h3 className="font-semibold tracking-tight text-foreground mb-4">
              Protocol
            </h3>
            <ul className="space-y-3">
              {protocolLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center gap-2">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* Resources Links Column */}
          <div className="col-span-2">
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
          {/* Legal Links Column */}
          <div className="col-span-2">
            <h3 className="font-semibold tracking-tight text-foreground mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
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
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Prometheus Protocol. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
