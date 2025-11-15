import {
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
  DataSafetyAttestationData,
  ToolsAttestationData,
  Tokens,
} from '@prometheus-protocol/ic-js';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { AppInfoAttestation } from './results/AppInfoAttestation';
import { DataSafetyAttestation } from './results/DataSafetyAttestation';
import { ToolsAttestation } from './results/ToolsAttestation';
import { BuildReproducibilityAttestation } from './results/BuildReproducibilityAttestation';
import { ToolsAttestationForm } from './forms/ToolsAttestationForm';
import { Section } from '@/components/Section';
import { useGetTokenBalance } from '@/hooks/usePayment';
import { AppInfoAttestationForm } from './forms/AppInfoAttestationForm';
import { BuildReproducibilityAttestationForm } from './forms/BuildReproducibilityAttestationForm';
import { DivergenceReport } from './results/DivergenceReport';
import { DataSafetyAttestationForm } from './forms/DataSafetyAttestationForm';

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
          This audit requires a stake of USDC tokens to begin. Ensure your
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
    case 'tools_v1':
      return <ToolsAttestationForm audit={audit} />;
    case 'build_reproducibility_v1':
      return <BuildReproducibilityAttestationForm audit={audit} />;
    case 'data_safety_v1':
      return <DataSafetyAttestationForm audit={audit} />;
    default:
      return (
        <p>Attestation form for {audit.auditType} is not yet implemented.</p>
      );
  }
};

// --- 2. RESTRUCTURE THE MAIN AuditContent COMPONENT ---
export const AuditContent = ({ audit }: { audit: AuditBountyWithDetails }) => {
  const { identity } = useInternetIdentity();
  const getUsdcBalance = useGetTokenBalance(Tokens.USDC);
  const currentBalanceAtomic = getUsdcBalance.data ?? 0n;
  const hasStake = currentBalanceAtomic >= audit.stake;

  // --- REFACTORED LOGIC ---

  // State 1: Audit is complete. Show the appropriate result (success or failure).
  if (audit.status === 'Completed') {
    // This guard is important in case the results are somehow missing.
    if (!audit.results) {
      return <p>Audit is complete, but results are unavailable.</p>;
    }

    // Use the discriminated union 'type' to render the correct component.
    switch (audit.results.type) {
      case 'success':
        const {
          auditType,
          results: { data },
        } = audit;
        // This inner switch handles the different types of SUCCESSFUL attestations.
        switch (auditType) {
          case 'app_info_v1':
            return <AppInfoAttestation data={data as AppInfoAttestationData} />;
          case 'data_safety_v1':
            return (
              <DataSafetyAttestation data={data as DataSafetyAttestationData} />
            );
          case 'tools_v1':
            return (
              <ToolsAttestation
                data={data as ToolsAttestationData}
                audit={audit}
              />
            );
          case 'build_reproducibility_v1':
            return (
              <BuildReproducibilityAttestation
                data={data as BuildReproducibilityAttestationData}
                auditor={audit.results.auditor}
              />
            );
          default:
            return <p>Unknown attestation type: {auditType}</p>;
        }

      case 'failure':
        // This case handles the DIVERGENCE report outcome.
        return <DivergenceReport reason={audit.results.reason} />;
    }
  }

  // State 2: Audit is "In Prog" and claimed by the current user. Show the form.
  const isClaimedByCurrentUser =
    identity && audit.claimedBy?.toText() === identity.getPrincipal().toText();

  if (isClaimedByCurrentUser) {
    return (
      <div className="space-y-16">
        <AttestationForm audit={audit} />
      </div>
    );
  }

  // State 3: Default state (Open, or In Prog by another user). Show instructions.
  return (
    <div className="space-y-16">
      <InstructionsSection hasStake={hasStake} />
    </div>
  );
};
