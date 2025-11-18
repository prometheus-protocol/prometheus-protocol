import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BadgeCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CertificateSummaryCard } from '@/components/CertificateSummaryCard';
import { useGetAppDetailsByNamespace } from '@/hooks/useAppStore';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import {
  CORE_AUDIT_TYPES,
  ProcessedAuditRecord,
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
import { CoreAuditStatusCard } from '@/components/server-details/CoreAuditStatusCard';

// --- CONSTANTS & HELPERS ---
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

// --- MAIN CertificatePage Component ---

export function CertificatePage() {
  const { appId, wasmId } = useParams<{
    appId: string;
    wasmId?: string;
  }>();

  const {
    data: appDetails,
    isLoading,
    isError,
    refetch,
  } = useGetAppDetailsByNamespace(appId, wasmId);

  const [sponsoringAuditType, setSponsoringAuditType] = useState<string | null>(
    null,
  );

  if (isLoading) return <CertificatePageSkeleton />;
  if (isError) return <CertificatePageError onRetry={refetch} />;
  if (!appDetails) return <NotFoundPage />;

  const { latestVersion } = appDetails;
  const tierInfo = getTierInfo(latestVersion.securityTier);
  const buildInfo = latestVersion.buildInfo;

  return (
    <>
      <div
        className="w-full max-w-6xl mx-auto pt-12 mb-24 relative"
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
          <Link to={`/app/${appDetails.namespace}`} className="hover:underline">
            App Info
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-200">Certificate</span>
        </nav>

        <div className="relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-32">
            <div className="lg:col-span-2">
              <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3 mb-12">
                {appDetails.name}
                {latestVersion.securityTier !== 'Unranked' && (
                  <BadgeCheck className="h-8 w-8 text-primary" />
                )}
              </h1>
              <CertificateSummaryCard appDetails={appDetails} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-12">
                {CORE_AUDIT_TYPES.map((auditType) => {
                  const record = latestVersion.auditRecords.find(
                    (rec: ProcessedAuditRecord) => {
                      if (rec.type === 'attestation')
                        return rec.audit_type === auditType;
                      if (rec.type === 'divergence')
                        return auditType === 'build_reproducibility_v1';
                      return false;
                    },
                  );
                  const bounty = latestVersion.bounties.find(
                    (b) => b.challengeParameters.audit_type === auditType,
                  );

                  let status:
                    | 'success'
                    | 'failure'
                    | 'pending'
                    | 'unavailable' = 'unavailable';
                  if (record?.type === 'attestation') status = 'success';
                  else if (record?.type === 'divergence') status = 'failure';
                  else if (bounty) status = 'pending';

                  return (
                    <CoreAuditStatusCard
                      key={auditType}
                      auditType={auditType}
                      status={status}
                      record={record}
                      bounty={bounty}
                      appId={latestVersion.wasmId}
                      onSponsorClick={() => setSponsoringAuditType(auditType)}
                    />
                  );
                })}
              </div>
              <div className="space-y-3 mb-12 font-mono text-md">
                <div>
                  <p>Wasm Hash: </p>
                  <p className="text-muted-foreground break-words">
                    {latestVersion.wasmId}
                  </p>
                </div>
                {buildInfo?.gitCommit && (
                  <div>
                    <p>Git Commit: </p>
                    <p className="text-muted-foreground break-words">
                      {buildInfo.gitCommit}
                    </p>
                  </div>
                )}
                {buildInfo?.repoUrl && buildInfo.gitCommit && (
                  <a
                    className="inline-flex items-center text-sm text-primary hover:underline mt-2"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`${buildInfo.repoUrl}/commit/${buildInfo.gitCommit}`}>
                    View Commit on GitHub
                  </a>
                )}
                {buildInfo?.status === 'failure' && (
                  <div className="text-red-400 pt-4">
                    <p className="font-sans font-semibold">
                      Build Failure Reason:
                    </p>
                    <p className="text-muted-foreground font-sans whitespace-pre-wrap">
                      {buildInfo.failureReason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="relative hidden lg:flex items-end justify-end">
              <div className="relative">
                <img
                  src="/images/prometheus.webp"
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

          {/* <Accordion
            type="multiple"
            className="w-full border border-primary/60 divide-y divide-primary/60">
            <AccordionItem value="dependencies" className="px-4">
              <AccordionTrigger className="text-lg font-semibold py-4 hover:no-underline">
                Dependencies
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 text-muted-foreground">
                Details about project dependencies and their verified sources
                will be listed here.
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
          </Accordion> */}
        </div>
      </div>

      {/* <CreateBountyDialog
        isOpen={!!sponsoringAuditType}
        onOpenChange={(open) => !open && setSponsoringAuditType(null)}
        wasmId={latestVersion.wasmId}
        auditType={sponsoringAuditType ?? ''}
        verificationRequest={Tokens.generateVerificationRequest()}
      /> */}
    </>
  );
}
