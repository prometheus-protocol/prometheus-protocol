import { useParams, Link } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldCheck, Wallet, Wrench } from 'lucide-react';

// Component Imports
import { ServerHeader } from '@/components/server-details/ServerHeader';
import { SimilarApps } from '@/components/server-details/SimilarApps';
import { ToolsAndResources } from '@/components/server-details/ToolsAndResources';
import { DataSafetySection } from '@/components/server-details/DataSafetySection';
import { ReviewsSection } from '@/components/server-details/ReviewsSection';
import { AboutSection } from '@/components/server-details/AboutSection';
import { useGetAppDetailsByNamespace } from '@/hooks/useAppStore';
import { InstallDialog } from '@/components/server-details/InstallDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { Tokens } from '@prometheus-protocol/ic-js';
import { CreateBountyDialog } from '@/components/server-details/CreateBountyDialog';
import { AccessAndBilling } from '@/components/server-details/AccessAndBilling';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { ConnectionInfo } from '@/components/server-details/ConnectionInfo';
import { SponsorPrompt } from '@/components/server-details/SponsorPrompt';

// --- NEW High-Fidelity Skeleton Component ---
const ServerDetailsSkeleton = () => (
  <div className="w-full max-w-6xl mx-auto py-8 pb-32 animate-pulse">
    {/* Header Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-8">
      <div className="lg:col-span-3 space-y-8">
        <div className="h-4 w-1/4 bg-muted rounded" /> {/* Breadcrumbs */}
        <div className="h-10 w-3/4 bg-muted rounded" /> {/* Title */}
        <div className="flex items-center gap-6">
          <div className="w-11 h-11 rounded-md bg-muted/50" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 bg-muted/50 rounded" />
            <div className="h-3 w-1/3 bg-muted/50 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-12 w-36 bg-muted rounded-lg" />
          <div className="h-10 w-32 bg-muted/50 rounded-lg" />
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="aspect-video w-full bg-muted rounded-lg" />
      </div>
    </div>

    {/* Body Skeleton */}
    <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-x-16">
      <div className="lg:col-span-2 space-y-16 mt-8">
        <div className="h-64 bg-muted rounded-lg" /> {/* About Section */}
        <div className="h-48 bg-muted rounded-lg" /> {/* Tools Section */}
      </div>
      <aside className="lg:col-span-1 mt-8">
        <div className="h-96 bg-muted rounded-lg" /> {/* Similar Apps */}
      </aside>
    </div>
  </div>
);

// --- NEW User-Friendly Error Component ---
const ServerDetailsError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="w-full max-w-6xl mx-auto py-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
    <AlertTriangle className="w-16 h-16 text-destructive/50 mb-6" />
    <h2 className="text-2xl font-bold">Failed to Load App Details</h2>
    <p className="mt-2 text-muted-foreground max-w-md">
      There was a problem retrieving the information for this application.
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

export default function ServerDetailsPage() {
  // --- 2. USE `namespace` FROM THE URL, NOT `appId` ---
  const { appId, wasmId } = useParams<{ appId: string; wasmId?: string }>();
  const [isBountyDialogOpen, setIsBountyDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<
    'closed' | 'install' | 'confirm'
  >('closed');

  // --- 3. CALL THE NEW, CORRECT HOOK ---
  const {
    data: server,
    isLoading,
    isError,
    refetch,
  } = useGetAppDetailsByNamespace(appId, wasmId);

  if (isLoading) {
    return <ServerDetailsSkeleton />;
  }
  if (isError) {
    return <ServerDetailsError onRetry={refetch} />;
  }
  if (!server) {
    return <NotFoundPage />;
  }

  // --- 4. DECONSTRUCT `latestVersion` FOR CLEANER ACCESS ---
  // This is the key to making the rest of the component readable.
  const { latestVersion, allVersions } = server;

  const isViewingArchivedVersion =
    allVersions.length > 0 && latestVersion.wasmId !== allVersions[0].wasmId;

  const handleInstallClick = () => {
    // Logic now correctly checks the nested property.
    if (latestVersion.securityTier === 'Unranked') {
      setDialogState('confirm');
    } else {
      setDialogState('install');
    }
  };

  // --- 1. Determine which sections have data ---
  // The presence of a description indicates the 'app_info_v1' attestation is complete.
  const hasAppInfo = server.latestVersion.auditRecords.some(
    (record) => 'audit_type' in record && record.audit_type === 'app_info_v1',
  );

  console.log(server.latestVersion.auditRecords);
  // The presence of tools indicates the 'tools_v1' attestation is complete.
  const hasToolsInfo = server.latestVersion.auditRecords.some(
    (record) => 'audit_type' in record && record.audit_type === 'tools_v1',
  );
  // The presence of dataSafety indicates the 'data_safety_v1' attestation is complete.
  const hasDataSafetyInfo = server.latestVersion.auditRecords.some(
    (record) =>
      'audit_type' in record && record.audit_type === 'data_safety_v1',
  );

  // Bounties are version-specific, so we search in the `latestVersion` object.
  const toolsBounty = latestVersion.bounties.find(
    (bounty) => bounty.challengeParameters.audit_type === 'tools_v1',
  );
  const appInfoBounty = latestVersion.bounties.find(
    (bounty) => bounty.challengeParameters.audit_type === 'app_info_v1',
  );
  const dataSafetyBounty = latestVersion.bounties.find(
    (bounty) => bounty.challengeParameters.audit_type === 'data_safety_v1',
  );

  const acceptsPayments = latestVersion.tools.some((tool) => !!tool.cost);

  return (
    <>
      <div className="w-full max-w-6xl mx-auto pt-12 pb-32">
        {/* --- 5. UPDATE PROPS PASSED TO CHILD COMPONENTS --- */}

        {/* ServerHeader and AboutSection take the whole object, as they use both stable and versioned data. */}
        <ServerHeader
          server={server}
          onInstallClick={handleInstallClick}
          isArchived={isViewingArchivedVersion}
        />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-8">
          <main className="lg:col-span-3 space-y-16 mt-8">
            {/* Conditionally render the new container component */}

            {hasAppInfo ? (
              <AboutSection server={server} />
            ) : (
              <SponsorPrompt
                icon={AlertTriangle}
                title="App Info"
                description="Sponsor the App Info audit to provide users with detailed information about this application."
                auditType="app_info_v1"
                paymentToken={Tokens.USDC}
                bounty={appInfoBounty} // Assuming no bounty for app_info_v1 in this context
                wasmId={server.latestVersion.wasmId}
                isArchived={isViewingArchivedVersion}
              />
            )}

            {hasToolsInfo && acceptsPayments ? (
              <AccessAndBilling latestVersion={server.latestVersion} />
            ) : (
              <SponsorPrompt
                icon={Wallet}
                title="Access & Billing"
                description="Sponsor the Tools & Resources audit to enable API key creation and manage wallet allowances for this app."
                auditType="tools_v1"
                bounty={toolsBounty}
                paymentToken={Tokens.USDC}
                wasmId={server.latestVersion.wasmId}
                isArchived={isViewingArchivedVersion}
              />
            )}

            {/* Conditional rendering now correctly checks the nested status. */}
            {hasToolsInfo ? (
              <ToolsAndResources
                tools={latestVersion.tools}
                wasmId={latestVersion.wasmId}
              />
            ) : (
              <SponsorPrompt
                icon={Wrench}
                title="Tools and Resources"
                description="Sponsor the Tools & Resources audit to see what developer tools and APIs this app provides."
                auditType="tools_v1"
                bounty={toolsBounty}
                paymentToken={Tokens.USDC}
                wasmId={server.latestVersion.wasmId}
                isArchived={isViewingArchivedVersion}
              />
            )}

            {hasDataSafetyInfo ? (
              <DataSafetySection safetyInfo={latestVersion.dataSafety!} />
            ) : (
              <SponsorPrompt
                icon={ShieldCheck} // Assuming ShieldCheck for Data Safety
                title="Data Safety"
                description="Sponsor the Data Safety audit to understand how this application handles your data."
                auditType="data_safety_v1"
                bounty={dataSafetyBounty}
                paymentToken={Tokens.USDC}
                wasmId={server.latestVersion.wasmId}
                isArchived={isViewingArchivedVersion}
              />
            )}
          </main>

          <aside className="lg:col-span-2 space-y-8">
            {/* SimilarApps should use the STABLE namespace to find related apps. */}
            <SimilarApps currentServerNamespace={server.namespace} />
          </aside>
        </div>
      </div>

      {/* Dialogs now receive the correct, version-specific wasmId. */}
      <CreateBountyDialog
        isOpen={isBountyDialogOpen}
        onOpenChange={setIsBountyDialogOpen}
        wasmId={latestVersion.wasmId}
        auditType="app_info_v1"
        paymentToken={Tokens.USDC}
      />

      {/* InstallDialog takes the whole object and will need to be updated internally. */}
      <InstallDialog
        server={server}
        open={dialogState === 'install'}
        onOpenChange={(open) => !open && setDialogState('closed')}
      />

      <AlertDialog
        open={dialogState === 'confirm'}
        onOpenChange={(open) => !open && setDialogState('closed')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Connect to an Uncertified Server?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This server, <span className="font-bold">{server.name}</span>, has
              not been audited by Prometheus Protocol. Proceed with caution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setDialogState('install');
              }}>
              I Understand, Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
