import {
  FileText,
  Github,
  Info,
  ExternalLink,
  PlayCircle,
  Coins,
  LogIn,
  Check,
} from 'lucide-react';
import { ReactNode } from 'react';
import {
  AppInfoAttestationData,
  AuditBountyWithDetails,
  BuildReproducibilityAttestationData,
  SecurityAttestationData,
  ToolsAttestationData,
} from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { AppInfoAttestation } from './results/AppInfoAttestation';
import { SecurityAttestation } from './results/SecurityAttestation';
import { ToolsAttestation } from './results/ToolsAttestation';
import { BuildReproducibilityAttestation } from './results/BuildReproducibilityAttestation';
import { SecurityAttestationForm } from './forms/SecurityAttestationForm';
import { ToolsAttestationForm } from './forms/ToolsAttestationForm';
import { Section } from '@/components/Section';
import { useGetReputationBalance } from '@/hooks/useAuditBounties';
import { AppInfoAttestationForm } from './forms/AppInfoAttestationForm';

// --- 1. EXTRACT REUSABLE SECTIONS INTO THEIR OWN COMPONENTS ---
const InstructionsSection = ({ hasStake }: { hasStake: boolean }) => {
  const { identity } = useInternetIdentity();

  const Step = ({
    icon,
    title,
    children,
  }: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
  }) => (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 h-8 w-8 m:h-12 m:w-12 flex items-center justify-center rounded-full border border-gray-600 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-gray-400 mt-1">{children}</p>
      </div>
    </div>
  );

  return (
    <Section title="How to Complete" icon={<Info className="text-primary" />}>
      <div className="space-y-6 py-4">
        <Step
          icon={
            identity ? (
              <Check className="w-6 h-6 text-green-500" />
            ) : (
              <LogIn className="w-6 h-6" />
            )
          }
          title="Step 1: Log In">
          You must be logged in with your Internet Identity to start an audit.
          Use the button in the bounty panel to log in.
        </Step>
        <Step
          icon={
            hasStake ? (
              <Check className="w-6 h-6 text-green-500" />
            ) : (
              <Coins className="w-6 h-6" />
            )
          }
          title="Step 2: Obtain Stake">
          This audit requires a stake of reputation tokens to begin. Ensure your
          account has the required balance.
          <a
            href="https://docs.prometheusprotocol.org/guides/auditors/overview"
            className="text-primary hover:underline ml-2"
            target="_blank"
            rel="noopener noreferrer">
            Learn more.
            <ExternalLink className="inline-block h-3.5 w-3.5 ml-1" />
          </a>
        </Step>
        <Step
          icon={<PlayCircle className="w-6 h-6" />}
          title="Step 3: Start the Audit">
          Click the "Start Audit" button in the bounty panel. This will reserve
          the bounty for you and transition the page to the submission form.
        </Step>
      </div>
    </Section>
  );
};

const AttestationForm = ({ audit }: { audit: AuditBountyWithDetails }) => {
  switch (audit.auditType) {
    case 'app_info_v1':
      return <AppInfoAttestationForm audit={audit} />;
    case 'security_v1':
      return <SecurityAttestationForm audit={audit} />;
    case 'tools_v1':
      return <ToolsAttestationForm audit={audit} />;
    default:
      return (
        <p>Attestation form for {audit.auditType} is not yet implemented.</p>
      );
  }
};

// --- 2. RESTRUCTURE THE MAIN AuditContent COMPONENT ---

export const AuditContent = ({ audit }: { audit: AuditBountyWithDetails }) => {
  const { identity } = useInternetIdentity();
  const getReputationBalance = useGetReputationBalance(audit.auditType);
  const currentBalance = getReputationBalance.data ?? 0;
  const hasStake = currentBalance > audit.stake;

  // State 1: Audit is complete. Show only the results.
  if (audit.status !== 'In Prog' && audit.results?.attestationData) {
    const {
      auditType,
      results: { attestationData },
    } = audit;
    switch (auditType) {
      case 'app_info_v1':
        return (
          <AppInfoAttestation
            data={attestationData as AppInfoAttestationData}
          />
        );
      case 'security_v1':
        return (
          <SecurityAttestation
            data={attestationData as SecurityAttestationData}
          />
        );
      case 'tools_v1':
        return (
          <ToolsAttestation data={attestationData as ToolsAttestationData} />
        );
      case 'build_reproducibility_v1':
        return (
          <BuildReproducibilityAttestation
            data={attestationData as BuildReproducibilityAttestationData}
          />
        );
      default:
        return <p>Unknown attestation type: {auditType}</p>;
    }
  }

  // For all other states (Open, In Prog), determine the main content and show resources.
  const isClaimedByCurrentUser =
    identity && audit.claimedBy?.toText() === identity.getPrincipal().toText();

  return (
    <div className="space-y-16">
      {/* The main content is now conditional: either the form or the instructions */}
      {isClaimedByCurrentUser ? (
        <AttestationForm audit={audit} />
      ) : (
        <InstructionsSection hasStake={hasStake} />
      )}
    </div>
  );
};
