import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Prometheus Protocol App Store';
const SITE_URL = 'https://gyeil-qyaaa-aaaai-q32uq-cai.icp0.io';
const DEFAULT_DESCRIPTION =
  'Discover, verify, and run Internet Computer apps with open-source build verification, app certificates, and MCP-ready tooling.';
const DEFAULT_IMAGE = `${SITE_URL}/images/prometheus.webp`;

type SeoProps = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
};

function absoluteUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  return `${SITE_URL}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function Seo({
  title = SITE_NAME,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
}: SeoProps) {
  const location = useLocation();
  const canonicalUrl = absoluteUrl(canonicalPath ?? location.pathname);
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const imageUrl = absoluteUrl(image);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta
        name="robots"
        content={noindex ? 'noindex,nofollow' : 'index,follow'}
      />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={imageUrl} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}

export function RouteSeo() {
  const { pathname } = useLocation();

  if (pathname === '/') {
    return (
      <Seo
        title="Prometheus Protocol App Store"
        description="Discover Internet Computer apps with reproducible build verification, app certificates, and MCP-ready agent tooling."
        canonicalPath="/"
      />
    );
  }

  if (pathname.startsWith('/audit-hub')) {
    return (
      <Seo
        title="Audit Hub"
        description="Track open verification jobs, reproducible build results, and app security attestations across the Prometheus verifier network."
        canonicalPath="/audit-hub"
      />
    );
  }

  if (pathname.startsWith('/bounties')) {
    return (
      <Seo
        title="App Bounties"
        description="Browse public Prometheus app verification bounties and open-source app review opportunities."
        canonicalPath="/bounties"
      />
    );
  }

  if (pathname.startsWith('/leaderboard')) {
    return (
      <Seo
        title="Verifier Leaderboard"
        description="See verifier network activity, reputation, and reward performance for Prometheus app verification."
        canonicalPath="/leaderboard"
      />
    );
  }

  if (pathname.startsWith('/verifier')) {
    return (
      <Seo
        title="Verifier Dashboard"
        description="Run build verification jobs and participate in the Prometheus decentralized verifier network."
        canonicalPath="/verifier"
      />
    );
  }

  if (pathname.startsWith('/about')) {
    return (
      <Seo
        title="About"
        description="Prometheus Protocol is an app store for Internet Computer software with open-source verification and agent-operable MCP apps."
        canonicalPath="/about"
      />
    );
  }

  if (pathname.startsWith('/faq')) {
    return (
      <Seo
        title="FAQ"
        description="Answers about Prometheus app verification, BYOC apps, reproducible builds, audits, and app installation."
        canonicalPath="/faq"
      />
    );
  }

  if (pathname.startsWith('/community')) {
    return (
      <Seo
        title="Community"
        description="Join the Prometheus Protocol community of Internet Computer app developers, verifiers, and users."
        canonicalPath="/community"
      />
    );
  }

  if (pathname.startsWith('/contact')) {
    return (
      <Seo
        title="Contact"
        description="Contact Prometheus Protocol about app publishing, verification, audits, and partnerships."
        canonicalPath="/contact"
      />
    );
  }

  if (pathname.startsWith('/privacy')) {
    return <Seo title="Privacy Policy" canonicalPath="/privacy" noindex />;
  }

  if (pathname.startsWith('/terms')) {
    return <Seo title="Terms of Service" canonicalPath="/terms" noindex />;
  }

  if (
    pathname.startsWith('/oauth') ||
    pathname.startsWith('/wallet') ||
    pathname.startsWith('/connections')
  ) {
    return <Seo title="Prometheus Protocol" noindex />;
  }

  return <Seo />;
}
