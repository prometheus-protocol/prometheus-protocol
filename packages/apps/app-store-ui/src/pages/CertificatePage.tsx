import { useParams, Link } from 'react-router-dom';
import { allServers, FeaturedServer } from '@/lib/mock-data';
import {
  BadgeCheck,
  Zap,
  Award,
  PackageCheckIcon,
  ShieldCheck,
  Github,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import NotFoundPage from './NotFoundPage';
import { cn, truncatePrincipal } from '@/lib/utils';
import { CertificateSummaryCard } from '@/components/CertificateSummaryCard';
import { getTierInfo } from '@/lib/get-tier-info';

const backgroundSvg = `url('/images/certificate.svg')`;

// Helper to get the right icon for each audit type
const auditIcons = {
  security: <ShieldCheck className="h-8 w-8 text-primary" />,
  quality: <Zap className="h-8 w-8 text-primary" />,
  build: <PackageCheckIcon className="h-8 w-8 text-primary" />,
};

export function CertificatePage() {
  const { serverId } = useParams<{ serverId: string }>();
  const server = allServers.find((s) => s.id === serverId);

  if (!server || !server.certificate) {
    return <NotFoundPage />;
  }

  const { certificate } = server;
  const tierInfo = getTierInfo({ certificate } as FeaturedServer);

  return (
    <div
      className="container mx-auto py-8 relative"
      style={{
        backgroundImage: backgroundSvg,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center 70px',
        backgroundSize: 'clamp(320px, 60vw, 400px)',
      }}>
      {/* Header with breadcrumbs */}
      {/* Breadcrumbs */}
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/server/${serverId}`} className="hover:underline">
          {server.name.split(':')[0]}
        </Link>
        <span className="mx-2">/</span>
        <span>Certificate</span>
      </nav>

      {/* Main Content Area */}
      <div className="relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-32">
          {/* Left Column: Details */}
          <div className="lg:col-span-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3 mb-12">
              {server.name}
              <BadgeCheck className="h-8 w-8 text-primary" />
            </h1>

            <CertificateSummaryCard certificate={server.certificate} />

            {/* Audits List */}
            <div className="space-y-8 mb-12">
              {certificate.audits.map((audit, index) => (
                <div key={index} className="flex items-center gap-6">
                  {/* Icon */}
                  {auditIcons[audit.type as keyof typeof auditIcons]}

                  {/* Details & Score */}
                  <div className="flex-grow">
                    {/* Top line with type and score */}
                    <div className="flex justify-between items-baseline mb-1">
                      <p className="text-lg font-semibold capitalize">
                        {audit.type.replace('-', ' ')}
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {audit.score}
                        <span className="text-sm font-normal text-muted-foreground">
                          /100
                        </span>
                      </p>
                    </div>

                    {/* Certification Details */}
                    <p className="text-sm font-mono text-muted-foreground">
                      Certified by:{' '}
                      <span className="text-foreground">
                        {truncatePrincipal(audit.certifiedBy)}
                      </span>
                    </p>
                    <p className="text-sm font-mono text-muted-foreground">
                      Certified on:{' '}
                      <span className="text-foreground">
                        {audit.certifiedOn}
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Hashes */}
            <div className="space-y-2 mb-12 font-mono text-md">
              <p>
                Wasm Hash:{' '}
                <span className="text-muted-foreground break-words">
                  {certificate.hashes.wasm}
                </span>
              </p>
              <p>
                Git Commit:{' '}
                <span className="text-muted-foreground break-words">
                  {certificate.hashes.gitCommit}
                </span>
              </p>
              <p>
                Canister ID:{' '}
                <span className="text-muted-foreground break-words">
                  {certificate.hashes.canisterId}
                </span>
              </p>
              <a
                href={`${certificate.repoUrl}/commit/${certificate.hashes.gitCommit}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 mt-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80">
                <Github className="h-4 w-4" />
                View Commit on GitHub
              </a>
            </div>
          </div>

          {/* Right Column: Mascot */}
          <div className="relative hidden lg:flex items-end justify-end">
            <div className="relative">
              <img
                src="/images/promie.png"
                alt="Prometheus Protocol Mascot"
                className="w-52 h-auto mb-12"
              />
              <div
                className={cn(
                  'absolute -top-24 right-24 bg-card border rounded-3xl p-3 min-w-60 bg-primary text-center',
                  tierInfo.borderColorClass, // Dynamic border color
                )}>
                <p className="text-background">{tierInfo.mascotText}</p>
                <div
                  className={cn(
                    'absolute right-8 -bottom-2 w-4 h-4 bg-card border-b border-r transform rotate-45 bg-primary',
                    tierInfo.borderColorClass, // Dynamic border color for the triangle
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Accordions */}
        <Accordion
          type="multiple"
          className="w-full border border-primary/60 divide-y divide-primary/60">
          <AccordionItem value="dependencies" className="px-4">
            <AccordionTrigger className="text-lg font-semibold py-4 hover:no-underline">
              Dependencies
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 text-muted-foreground">
              Details about project dependencies and their verified sources will
              be listed here.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="lineage" className="px-4">
            <AccordionTrigger className="text-lg font-semibold py-4 hover:no-underline">
              History and Lineage
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 text-muted-foreground">
              A complete, verifiable history of code commits, audits, and
              version lineage will be displayed here.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
