import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '../../../declarations/src/generated/mcp_registry/mcp_registry.did.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://gyeil-qyaaa-aaaai-q32uq-cai.icp0.io';
const SITE_NAME = 'Prometheus Protocol App Store';
const FALLBACK_IMAGE = `${SITE_URL}/images/prometheus.webp`;
const DEFAULT_DESCRIPTION =
  'Discover, verify, and run Internet Computer apps with reproducible build verification, app certificates, and MCP-ready tooling.';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');
const distDir = path.resolve(appDir, '..', '..', '..', 'dist', 'app_store_ui');
const indexPath = path.join(distDir, 'index.html');

type AppListing = {
  namespace: string;
  name: string;
  description: string;
  icon_url: string;
  banner_url: string;
  category: string;
  publisher: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(value?: string) {
  if (!value) return FALLBACK_IMAGE;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

function truncate(value: string, max: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function upsertMeta(html: string, app: AppListing) {
  const title = `${app.name} | ${SITE_NAME}`;
  const description = truncate(app.description || DEFAULT_DESCRIPTION, 180);
  const url = `${SITE_URL}/app/${encodeURIComponent(app.namespace)}`;
  const image = absoluteUrl(app.banner_url || app.icon_url);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: app.name,
    applicationCategory: app.category || 'DeveloperApplication',
    operatingSystem: 'Web',
    url,
    image,
    description,
    publisher: {
      '@type': 'Organization',
      name: app.publisher || 'Prometheus Protocol publisher',
    },
  });

  let output = html.replace(
    /<title>.*?<\/title>/s,
    `<title>${escapeHtml(title)}</title>`,
  );

  const appMeta = `
    <!-- App social preview metadata -->
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${escapeHtml(jsonLd)}</script>`;

  output = output.replace(
    /\s*<meta\s+name="description"[\s\S]*?<meta\s+name="apple-mobile-web-app-capable"/,
    `${appMeta}\n    <meta name="apple-mobile-web-app-capable"`,
  );

  return output;
}

async function main() {
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Build index not found at ${indexPath}. Run vite build first.`,
    );
  }

  const canisterIdsPath = path.resolve(
    appDir,
    '..',
    '..',
    '..',
    'canister_ids.json',
  );
  const canisterIds = JSON.parse(fs.readFileSync(canisterIdsPath, 'utf8'));
  const mcpRegistryId = canisterIds.mcp_registry?.ic;
  if (!mcpRegistryId)
    throw new Error('Missing mcp_registry.ic in canister_ids.json');

  const agent = new HttpAgent({ host: 'https://icp-api.io' });
  const actor = Actor.createActor(idlFactory, {
    agent,
    canisterId: mcpRegistryId,
  }) as any;

  const result = await actor.get_app_listings({
    filter: [],
    prev: [],
    take: [],
  });
  if ('err' in result)
    throw new Error(`get_app_listings failed: ${result.err}`);

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const listings = result.ok as AppListing[];
  for (const app of listings) {
    const routeDir = path.join(distDir, 'app', app.namespace);
    fs.mkdirSync(routeDir, { recursive: true });
    fs.writeFileSync(
      path.join(routeDir, 'index.html'),
      upsertMeta(indexHtml, app),
    );
  }

  const staticUrls = [
    '/',
    '/about',
    '/audit-hub',
    '/bounties',
    '/leaderboard',
    '/verifier',
    '/faq',
    '/community',
    '/contact',
  ];
  const appUrls = listings.map(
    (app) => `/app/${encodeURIComponent(app.namespace)}`,
  );
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...staticUrls,
    ...appUrls,
  ]
    .map(
      (url) =>
        `  <url><loc>${SITE_URL}${url}</loc><priority>${url.startsWith('/app/') ? '0.8' : url === '/' ? '1.0' : '0.7'}</priority></url>`,
    )
    .join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);

  console.log(`Generated ${listings.length} app social preview pages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
