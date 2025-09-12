import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BadgeCheck,
  PackageCheckIcon,
  Info,
  AlertTriangle,
  Hourglass,
  FileCode,
  Github,
  ToolCase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CertificateSummaryCard } from '@/components/CertificateSummaryCard';
import { useGetAppDetails } from '@/hooks/useAppStore';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn, truncatePrincipal } from '@/lib/utils';
import {
  AttestationData,
  AuditBounty,
  CORE_AUDIT_TYPES,
  ProcessedAttestation,
  Registry,
  Tokens,
} from '@prometheus-protocol/ic-js';
import NotFoundPage from './NotFoundPage';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CreateBountyDialog } from '@/components/server-details/CreateBountyDialog';

// --- CONSTANTS & HELPERS ---

const getAuditDisplayInfo = (auditType: string) => {
  switch (auditType) {
    case 'app_info_v1':
      return {
        name: 'Application Info',
        icon: <Info className="h-8 w-8 text-primary" />,
        missingIcon: <Info className="h-8 w-8 text-muted-foreground" />,
      };
    case 'build_reproducibility_v1':
      return {
        name: 'Build Reproducibility',
        icon: <PackageCheckIcon className="h-8 w-8 text-primary" />,
        missingIcon: (
          <PackageCheckIcon className="h-8 w-8 text-muted-foreground" />
        ),
      };
    case 'data_safety_v1':
      return {
        name: 'Data Safety',
        icon: <BadgeCheck className="h-8 w-8 text-primary" />,
        missingIcon: <BadgeCheck className="h-8 w-8 text-muted-foreground" />,
      };
    case 'tools_v1':
      return {
        name: 'Tool Info',
        icon: <ToolCase className="h-8 w-8 text-primary" />,
        missingIcon: <ToolCase className="h-8 w-8 text-muted-foreground" />,
      };
    default:
      return {
        name: auditType,
        icon: <FileCode className="h-8 w-8 text-primary" />,
        missingIcon: <FileCode className="h-8 w-8 text-muted-foreground" />,
      };
  }
};

const backgroundSvg = `url('/images/certificate.svg')`;

// --- HELPER COMPONENTS ---

const CertificatePageSkeleton = () => (
  <div
    className="w-full max-w-6xl mx-auto pt-8 mb-24 relative animate-pulse"
    style={{
      backgroundImage: backgroundSvg,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center 70px',
      backgroundSize: 'clamp(320px, 60vw, 400px)',
    }}>
    <div className="h-4 w-1/3 bg-muted rounded mb-8" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-32">
      <div className="lg:col-span-2 space-y-12">
        <div className="h-10 w-3/4 bg-muted rounded" />
        <div className="h-32 bg-muted/50 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-20 bg-muted/50 rounded-lg" />
          <div className="h-20 bg-muted/50 rounded-lg" />
          <div className="h-20 bg-muted/50 rounded-lg" />
          <div className="h-20 bg-muted/50 rounded-lg" />
        </div>
        <div className="h-40 bg-muted/50 rounded-lg" />
      </div>
    </div>
  </div>
);

const CertificatePageError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="w-full max-w-6xl mx-auto py-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
    <AlertTriangle className="w-16 h-16 text-destructive/50 mb-6" />
    <h2 className="text-2xl font-bold">Failed to Load Certificate</h2>
    <p className="mt-2 text-muted-foreground max-w-md">
      There was a problem retrieving the verification details for this app.
      Please try again.
    </p>
    <div className="mt-6 flex gap-4">
      <Button onClick={onRetry}>Try Again</Button>
      <Button variant="outline" asChild>
        <Link to="/">Return to Home</Link>
      </Button>
    </div>
  </div>
);

// --- NEW CoreAttestationCard Component ---

interface CoreAttestationCardProps {
  auditType: string;
  attestation?: ProcessedAttestation;
  bounty?: AuditBounty;
  appId: string;
}

function CoreAttestationCard({
  auditType,
  attestation,
  bounty,
  appId,
}: CoreAttestationCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const displayInfo = getAuditDisplayInfo(auditType);
  const paymentToken = Tokens.USDC;

  if (attestation) {
    const certifiedOn = new Date(
      Number(attestation.timestamp / 1_000_000n),
    ).toLocaleDateString();
    return (
      <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">{displayInfo.icon}</div>
          <div className="flex-grow">
            <p className="text-lg font-semibold">{displayInfo.name}</p>
            <p className="text-sm font-mono text-muted-foreground">
              Certified by:{' '}
              <span className="text-foreground">
                {truncatePrincipal(attestation.auditor.toText())}
              </span>
            </p>
            <p className="text-sm font-mono text-muted-foreground">
              Certified on:{' '}
              <span className="text-foreground">{certifiedOn}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (bounty) {
    return (
      <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex-shrink-0 mt-1">
          <Hourglass className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="flex-grow">
          <p className="text-lg font-semibold">{displayInfo.name}</p>
          <p className="text-sm text-muted-foreground mb-2">
            A bounty of{' '}
            <span className="font-bold text-foreground">
              {paymentToken.fromAtomic(bounty.tokenAmount)}{' '}
              {paymentToken.symbol}
            </span>{' '}
            is available.
          </p>
          <Button size="sm" variant="secondary" asChild>
            <Link to={`/audit-hub/${bounty.id.toString()}`}>View Bounty</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex-shrink-0 mt-1">{displayInfo.missingIcon}</div>
        <div className="flex-grow">
          <p className="text-lg font-semibold text-muted-foreground">
            {displayInfo.name}
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            This attestation is missing.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsDialogOpen(true)}>
            Sponsor Bounty
          </Button>
        </div>
      </div>
      <CreateBountyDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        appId={appId}
        auditType={auditType}
        paymentToken={paymentToken}
      />
    </>
  );
}

// --- MAIN CertificatePage Component ---

export function CertificatePage() {
  const { serverId } = useParams<{ serverId: string }>();
  const {
    data: appDetails,
    isLoading,
    isError,
    refetch,
  } = useGetAppDetails(serverId);

  const extractedData = useMemo(() => {
    if (!appDetails?.attestations) return {};
    const buildPayload =
      appDetails.attestations.find(
        (a) => a.audit_type === 'build_reproducibility_v1',
      )?.payload || {};
    return {
      gitCommit: buildPayload.git_commit || null,
      canisterId: buildPayload.canister_id || null,
      repoUrl: buildPayload.repo_url || null,
    };
  }, [appDetails]);

  if (isLoading) return <CertificatePageSkeleton />;
  if (isError) return <CertificatePageError onRetry={refetch} />;
  if (!appDetails) return <NotFoundPage />;

  const tierInfo = getTierInfo(appDetails.securityTier);

  return (
    <div
      className="w-full max-w-6xl mx-auto pt-8 mb-24 relative"
      style={{
        backgroundImage: backgroundSvg,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center 70px',
        backgroundSize: 'clamp(320px, 60vw, 400px)',
      }}>
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/server/${serverId}`} className="hover:underline">
          {appDetails.name}
        </Link>
        <span className="mx-2">/</span>
        <span>Certificate</span>
      </nav>

      <div className="relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-32">
          <div className="lg:col-span-2">
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3 mb-12">
              {appDetails.name}
              {appDetails.securityTier !== 'Unranked' && (
                <BadgeCheck className="h-8 w-8 text-primary" />
              )}
            </h1>
            <CertificateSummaryCard appDetails={appDetails} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-12">
              {CORE_AUDIT_TYPES.map((auditType) => {
                const attestation = appDetails.attestations.find(
                  (a) => a.audit_type === auditType,
                );
                const bounty = appDetails.bounties.find(
                  (b) => b.challengeParameters.audit_type === auditType,
                );
                return (
                  <CoreAttestationCard
                    key={auditType}
                    auditType={auditType}
                    attestation={attestation}
                    bounty={bounty}
                    appId={appDetails.id}
                  />
                );
              })}
            </div>

            <div className="space-y-2 mb-12 font-mono text-md">
              {extractedData.canisterId && (
                <p>
                  Canister ID:{' '}
                  <span className="text-muted-foreground break-words">
                    {extractedData.canisterId}
                  </span>
                </p>
              )}
              <p>
                Wasm Hash:{' '}
                <span className="text-muted-foreground break-words">
                  {serverId}
                </span>
              </p>
              {extractedData.gitCommit && (
                <p>
                  Git Commit:{' '}
                  <span className="text-muted-foreground break-words">
                    {extractedData.gitCommit}
                  </span>
                </p>
              )}
              {extractedData.repoUrl && extractedData.gitCommit && (
                <a
                  href={`${extractedData.repoUrl}/commit/${extractedData.gitCommit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 mt-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80">
                  <Github className="h-4 w-4" /> View Commit on GitHub
                </a>
              )}
            </div>
          </div>

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
                  tierInfo.borderColorClass,
                )}>
                <p className="text-background">{tierInfo.mascotText}</p>
                <div
                  className={cn(
                    'absolute right-8 -bottom-2 w-4 h-4 bg-card border-b border-r transform rotate-45 bg-primary',
                    tierInfo.borderColorClass,
                  )}
                />
              </div>
            </div>
          </div>
        </div>

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
