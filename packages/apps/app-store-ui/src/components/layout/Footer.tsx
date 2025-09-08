import { Link } from 'react-router-dom';
import { Logo } from '../Logo';
import { ExternalLink } from 'lucide-react';
import { GITHUB_LINK } from '@/lib/const';

// --- 1. DEFINE THE DOCS URL ---
const DOCS_LINK = 'https://docs.prometheusprotocol.org';

const protocolLinks = [
  { href: '/about', label: 'About Us' },
  {
    href: `${DOCS_LINK}/introduction`,
    label: 'Protocol Overview',
    external: true,
  },
  {
    href: `${DOCS_LINK}/guides/service-devs/overview`,
    label: 'For Developers',
    external: true,
  },
  {
    href: `${DOCS_LINK}/guides/auditors/overview`,
    label: 'For Auditors',
    external: true,
  },
  {
    href: GITHUB_LINK,
    label: 'GitHub',
    external: true,
  },
];

// --- 2. ADD THE DOCS LINK TO THE RESOURCES ARRAY ---
const resourcesLinks = [
  {
    href: DOCS_LINK,
    label: 'Documentation',
    external: true, // Mark as external
  },
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
      <div
        className="
          bg-primary/60
          absolute top-0 left-0 w-full h-px
        "
      />
      <div className="container pt-14 pb-8 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-9 gap-12 md:gap-24 border-b pb-12">
          <div className="col-span-3 flex flex-col items-start">
            <Logo className="mb-4 h-12 -mt-2" />
            <p className="text-sm text-muted-foreground mb-4 max-w-3xs">
              Rewarding Trusted, Open-Source AI.
            </p>
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold tracking-tight text-foreground mb-4">
              Protocol
            </h3>
            <ul className="space-y-3">
              {protocolLinks.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center gap-2">
                      {link.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center gap-2">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold tracking-tight text-foreground mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              {resourcesLinks.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center gap-2">
                      {link.label}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    // --- FIX: Added flex and items-center for consistency ---
                    <Link
                      to={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold tracking-tight text-foreground mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  {/* --- FIX: Added flex and items-center for consistency --- */}
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground flex items-center">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
