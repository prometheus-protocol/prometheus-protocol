import { useParams, Link } from 'react-router-dom';
import { allServers, FeaturedServer } from '@/lib/mock-data';
import {
  BadgeCheck,
  Zap,
  Award,
  PackageCheckIcon,
  ShieldCheck,
  Github,
  Info,
  FileCode,
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
import {
  useGetAppDetails,
  useGetVerificationStatus,
} from '@/hooks/useAppStore';
import { useMemo } from 'react';

const backgroundSvg = `url('/images/certificate.svg')`;

// Helper to get display info for each audit type
const getAuditDisplayInfo = (auditType: string) => {
  switch (auditType) {
    case 'security_v1':
      return {
        name: 'Security Audit',
        icon: <ShieldCheck className="h-8 w-8 text-primary" />,
      };
    case 'build_reproducibility_v1':
      return {
        name: 'Build Reproducibility',
        icon: <PackageCheckIcon className="h-8 w-8 text-primary" />,
      };
    case 'tools_v1':
      return {
        name: 'Tools & Resources',
        icon: <Zap className="h-8 w-8 text-primary" />,
      };
    case 'app_info_v1':
      return {
        name: 'Application Information',
        icon: <Info className="h-8 w-8 text-primary" />,
      };
    case 'data_safety_v1':
      return {
        name: 'Data Safety',
        icon: <Award className="h-8 w-8 text-primary" />,
      };
    default:
      return {
        name: auditType,
        icon: <FileCode className="h-8 w-8 text-primary" />,
      };
  }
};

export function CertificatePage() {
  const { serverId } = useParams<{ serverId: string }>();

  const { data: appDetails, isLoading: isAppDetailsLoading } =
    useGetAppDetails(serverId);
  const { data: verificationStatus, isLoading: isVerificationLoading } =
    useGetVerificationStatus(serverId);

  const isLoading = isAppDetailsLoading || isVerificationLoading;

  if (isLoading) {
    return <div>Loading certificate...</div>; // Or a skeleton component
  }

  // This memo correctly extracts version-specific proof data from the attestations.
  const extractedData = useMemo(() => {
    if (!verificationStatus?.attestations) return {};

    // Find the payload from the specific attestation that contains the build proof.
    const buildPayload =
      verificationStatus.attestations.find(
        (a) => a.audit_type === 'build_reproducibility_v1',
      )?.payload || {};

    return {
      gitCommit: buildPayload.git_commit || null,
      canisterId: buildPayload.canister_id || null,
      repoUrl: buildPayload.repo_url || null,
    };
  }, [verificationStatus]);

  if (!appDetails || !verificationStatus) {
    return <NotFoundPage />;
  }

  const tierInfo = getTierInfo(appDetails.securityTier);

  return (
    <div
      className="container mx-auto pt-8 mb-24 relative"
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
              {verificationStatus.isVerified && (
                <BadgeCheck className="h-8 w-8 text-primary" />
              )}
            </h1>

            <CertificateSummaryCard
              appDetails={appDetails}
              verificationStatus={verificationStatus}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10 mb-12">
              {verificationStatus.attestations.map((att, index) => {
                const displayInfo = getAuditDisplayInfo(att.audit_type);
                const certifiedOn = new Date(
                  Number(att.timestamp / 1_000_000n),
                ).toLocaleDateString();

                // Each item in the grid is a self-contained block.
                return (
                  <div key={index} className="flex items-start gap-4">
                    {/* Icon (using items-start alignment now) */}
                    <div className="flex-shrink-0 mt-1">{displayInfo.icon}</div>

                    {/* Details */}
                    <div className="flex-grow">
                      <p className="text-lg font-semibold capitalize">
                        {displayInfo.name}
                      </p>
                      <p className="text-sm font-mono text-muted-foreground">
                        Certified by:{' '}
                        <span className="text-foreground">
                          {truncatePrincipal(att.auditor.toText())}
                        </span>
                      </p>
                      <p className="text-sm font-mono text-muted-foreground">
                        Certified on:{' '}
                        <span className="text-foreground">{certifiedOn}</span>
                      </p>
                    </div>
                  </div>
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
                  <Github className="h-4 w-4" />
                  View Commit on GitHub
                </a>
              )}
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
