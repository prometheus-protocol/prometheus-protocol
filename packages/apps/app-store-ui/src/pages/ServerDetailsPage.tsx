import { useParams, Link } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ShieldCheck, Wallet, Wrench, Info } from 'lucide-react';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { cn } from '@/lib/utils';
import { getTierInfo } from '@/lib/get-tier-info';
import { Seo } from '@/components/Seo';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Component Imports
import { SimilarApps } from '@/components/server-details/SimilarApps';
import { ToolsAndResources } from '@/components/server-details/ToolsAndResources';
import { DataSafetySection } from '@/components/server-details/DataSafetySection';
import { AboutSection } from '@/components/server-details/AboutSection';
import { ConnectionInfo } from '@/components/server-details/ConnectionInfo';
import { StatsStrip } from '@/components/server-details/StatsStrip';
import { ProvisionInstance } from '@/components/server-details/ProvisionInstance';
import { MediaGallery } from '@/components/server-details/MediaGallery';
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
import { SponsorPrompt } from '@/components/server-details/SponsorPrompt';
import { VersionSelector } from '@/components/server-details/VersionSelector';
import { WasmHashDetails } from '@/components/server-details/WasmHashDetails';
import { AppTokenSection } from '@/components/server-details/AppTokenSection';
import {
  useGetCanisterId,
  useProvisionInstance,
  useGetAllVersionCanisterIds,
  useGetExternalCanisterId,
} from '@/hooks/useOrchestrator';
import { useGetAppMetrics } from '@/hooks/useUsageTracker';
import { useAggregatedAppMetrics } from '@/hooks/useAggregatedAppMetrics';
import { useNamespaceMetrics } from '@/hooks/useNamespaceMetrics';
import { getServerCanisterId } from '@prometheus-protocol/ic-js';
import { Principal } from '@icp-sdk/core/principal';

// --- NEW High-Fidelity Skeleton Component ---
const ServerDetailsSkeleton = () => (
  <div className="w-full max-w-6xl mx-auto py-12 pb-32 animate-pulse">
    {/* Breadcrumbs */}
    <div className="h-4 w-1/4 bg-muted rounded mb-8" />

    {/* Split columns layout */}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-16 gap-y-8">
      {/* Left column */}
      <div className="lg:col-span-3 space-y-16">
        {/* Title and info */}
        <div className="space-y-8">
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
          {/* Connection info placeholder */}
          <div className="mt-12 p-6 border border-muted rounded-lg bg-card/30">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-muted" />
              </div>
              <div className="flex-grow space-y-2">
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-4 w-64 bg-muted rounded" />
              </div>
              <div className="flex-shrink-0">
                <div className="h-12 w-32 bg-muted rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        {/* Content sections */}
        <div className="h-64 bg-muted rounded-lg" /> {/* About Section */}
        <div className="h-48 bg-muted rounded-lg" /> {/* Tools Section */}
      </div>

      {/* Right column */}
      <div className="lg:col-span-2 space-y-8">
        <div className="aspect-video w-full bg-muted rounded-lg" />{' '}
        {/* Gallery */}
        <div className="h-96 bg-muted rounded-lg" /> {/* Similar Apps */}
      </div>
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
  const [isPollingForCanister, setIsPollingForCanister] = useState(false);
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  // --- 3. CALL THE NEW, CORRECT HOOK ---
  const {
    data: server,
    isLoading,
    isError,
    refetch,
  } = useGetAppDetailsByNamespace(appId, wasmId);
  const {
    data: canisterId,
    isLoading: isLoadingCanisterId,
    refetch: refetchCanisterId,
  } = useGetCanisterId(server?.namespace, server?.latestVersion.wasmId);

  // For BYOC (external) apps, the orchestrator won't have a canister ID.
  // Fall back to the registry's external binding.
  const isByoc = server?.latestVersion.status === 'External';
  const { data: externalCanisterId, isLoading: isLoadingExternalCanisterId } =
    useGetExternalCanisterId(isByoc ? server?.namespace : undefined);

  // Use orchestrator canister ID first, fall back to external binding for BYOC
  const resolvedCanisterId = canisterId ?? externalCanisterId ?? null;
  const isLoadingAnyCanisterId =
    isLoadingCanisterId || (isByoc && isLoadingExternalCanisterId);

  // Fetch canister IDs for all WASM versions to aggregate metrics
  const { canisterIds: allCanisterIds } = useGetAllVersionCanisterIds(
    server?.namespace,
    server?.allVersions,
  );

  // Use aggregated metrics across all versions
  const { data: aggregatedMetrics, isLoading: isLoadingMetrics } =
    useAggregatedAppMetrics(
      allCanisterIds.length > 0 ? allCanisterIds : undefined,
    );

  // Try to get namespace-level metrics (new backend feature)
  const { data: namespaceMetrics } = useNamespaceMetrics(server?.namespace);

  // Use namespace metrics if available, otherwise fall back to aggregated canister metrics
  const displayMetrics = useMemo(() => {
    if (namespaceMetrics) {
      return {
        authenticated_unique_users: namespaceMetrics.authenticated_unique_users,
        anonymous_invocations: namespaceMetrics.anonymous_invocations,
        total_tools: namespaceMetrics.total_tools,
        total_invocations: namespaceMetrics.total_invocations,
      };
    }
    return aggregatedMetrics;
  }, [namespaceMetrics, aggregatedMetrics]);

  // --- 4. PROVISION HOOK ---
  const provisionMutation = useProvisionInstance(server?.namespace);

  // --- 5. OWNERSHIP LOGIC ---
  const isOwnerOrDeveloper = useMemo(() => {
    if (!identity || !server) return false;

    // For global apps: check if user is the developer/publisher
    if (server.deploymentType === 'global') {
      // For now, return false as we need publisher principal logic
      // TODO: Implement publisher principal comparison when available
      return false;
    }

    // For provisioned apps: check if user is the owner of this instance
    if (server.deploymentType === 'provisioned' && resolvedCanisterId) {
      // For provisioned instances, the user who can access it is typically the owner
      // This is a simplified check - in practice you might need to call a canister method
      return true;
    }

    return false;
  }, [identity, server, resolvedCanisterId]);

  // Combine loading states - show skeleton until all critical data is loaded
  const isLoadingAnyData = isLoading || (server && isLoadingAnyCanisterId);

  if (isLoadingAnyData) {
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

  // Get tier info for display
  const tierInfo = getTierInfo(
    latestVersion.securityTier,
    latestVersion.status,
  );

  // Helper to determine if the app is the 'Provisioned' type
  const isProvisionedApp =
    server.deploymentType && server.deploymentType === 'provisioned';

  const isViewingArchivedVersion =
    allVersions.length > 0 && latestVersion.wasmId !== allVersions[0].wasmId;

  const handleInstallClick = () => {
    // Logic now correctly checks the nested property.
    if (
      latestVersion.status === 'External' ||
      latestVersion.securityTier === 'Unranked'
    ) {
      setDialogState('confirm');
    } else {
      setDialogState('install');
    }
  };

  const handleProvisionClick = async (namespace: string) => {
    if (!server) return;

    try {
      await provisionMutation.mutateAsync({
        namespace,
        wasmId: server.latestVersion.wasmId,
      });

      // Start polling for the canister ID after successful provisioning
      setIsPollingForCanister(true);

      // Poll every 2 seconds for up to 60 seconds
      const pollForCanister = async () => {
        const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds
        let attempts = 0;

        const poll = async (): Promise<void> => {
          attempts++;

          try {
            const result = await refetchCanisterId();

            if (result.data) {
              // Canister ID found, continue polling for WASM hash verification
              const canisterId = result.data; // Store the canister ID to avoid undefined issues
              const pollForWasmHash = async () => {
                const wasmMaxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds
                let wasmAttempts = 0;

                const wasmPoll = async (): Promise<void> => {
                  wasmAttempts++;

                  try {
                    // Force refetch of WASM hash query
                    await queryClient.invalidateQueries({
                      queryKey: ['canisterWasmHash', canisterId.toText()],
                    });

                    // Check if we have WASM hash data now
                    const wasmHashData = queryClient.getQueryData([
                      'canisterWasmHash',
                      canisterId.toText(),
                    ]);

                    if (wasmHashData !== undefined && wasmHashData !== null) {
                      // WASM hash available, stop all polling
                      setIsPollingForCanister(false);
                      return;
                    }

                    if (wasmAttempts < wasmMaxAttempts) {
                      // Continue polling for WASM hash
                      setTimeout(wasmPoll, 2000);
                    } else {
                      // WASM hash polling timeout, but canister is available
                      setIsPollingForCanister(false);
                      console.warn(
                        'WASM hash polling timeout: Hash not available after maximum attempts',
                      );
                    }
                  } catch (error) {
                    if (wasmAttempts < wasmMaxAttempts) {
                      // Retry on error
                      setTimeout(wasmPoll, 2000);
                    } else {
                      setIsPollingForCanister(false);
                      console.error(
                        'WASM hash polling failed after maximum attempts:',
                        error,
                      );
                    }
                  }
                };

                // Start WASM hash polling after a short delay
                setTimeout(wasmPoll, 1000);
              };

              // Start WASM hash polling
              pollForWasmHash();
              return;
            }

            if (attempts < maxAttempts) {
              // Continue polling
              setTimeout(poll, 2000);
            } else {
              // Max attempts reached, stop polling
              setIsPollingForCanister(false);
              console.warn(
                'Polling timeout: Canister ID not found after maximum attempts',
              );
            }
          } catch (error) {
            if (attempts < maxAttempts) {
              // Retry on error
              setTimeout(poll, 2000);
            } else {
              setIsPollingForCanister(false);
              console.error('Polling failed after maximum attempts:', error);
            }
          }
        };

        // Start polling after a short delay to allow for immediate availability
        setTimeout(poll, 1000);
      };

      pollForCanister();
    } catch (error) {
      // Error is handled by the custom mutation hook
      console.error('Provisioning failed:', error);
      setIsPollingForCanister(false);
    }
  };

  const handleUpgradeClick = async () => {
    if (!server || !resolvedCanisterId) return;

    // Always upgrade to the actual latest version (allVersions[0]), not the viewed version
    const actualLatestVersion = allVersions[0];
    if (!actualLatestVersion) return;

    try {
      // Start polling state
      setIsPollingForCanister(true);

      // For provisioned instances, we use provision_instance which handles upgrades
      await provisionMutation.mutateAsync({
        namespace: server.namespace,
        wasmId: actualLatestVersion.wasmId,
      });

      // After successful upgrade, poll for the WASM hash to verify the upgrade completed
      const pollForWasmHash = async () => {
        const wasmMaxAttempts = 15; // 15 attempts * 2 seconds = 30 seconds
        let wasmAttempts = 0;

        const wasmPoll = async (): Promise<void> => {
          wasmAttempts++;

          try {
            // Force refetch of WASM hash query
            await queryClient.invalidateQueries({
              queryKey: ['canisterWasmHash', resolvedCanisterId.toText()],
            });

            // Check if we have WASM hash data now
            const wasmHashData = queryClient.getQueryData([
              'canisterWasmHash',
              resolvedCanisterId.toText(),
            ]);

            if (wasmHashData !== undefined && wasmHashData !== null) {
              // WASM hash available, stop polling
              setIsPollingForCanister(false);

              // If we're viewing an archived version, redirect to the latest version
              if (isViewingArchivedVersion) {
                window.location.href = `/app/${server.namespace}`;
              }
              return;
            }

            if (wasmAttempts < wasmMaxAttempts) {
              // Continue polling for WASM hash
              setTimeout(wasmPoll, 2000);
            } else {
              // WASM hash polling timeout
              setIsPollingForCanister(false);
              console.warn(
                'WASM hash polling timeout: Hash not available after maximum attempts',
              );

              // Still redirect if needed, even if polling timed out
              if (isViewingArchivedVersion) {
                window.location.href = `/app/${server.namespace}`;
              }
            }
          } catch (error) {
            if (wasmAttempts < wasmMaxAttempts) {
              // Retry on error
              setTimeout(wasmPoll, 2000);
            } else {
              setIsPollingForCanister(false);
              console.error(
                'WASM hash polling failed after maximum attempts:',
                error,
              );

              // Still redirect if needed, even if polling failed
              if (isViewingArchivedVersion) {
                window.location.href = `/app/${server.namespace}`;
              }
            }
          }
        };

        // Start WASM hash polling after a short delay
        setTimeout(wasmPoll, 1000);
      };

      // Start WASM hash polling
      pollForWasmHash();
    } catch (error) {
      // Error is handled by the custom mutation hook
      console.error('Upgrade failed:', error);
      setIsPollingForCanister(false);
    }
  };

  // --- 1. Determine which sections have data ---
  // The presence of a description indicates the 'app_info_v1' attestation is complete.
  const hasAppInfo = server.latestVersion.auditRecords.some(
    (record) => 'audit_type' in record && record.audit_type === 'app_info_v1',
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

  // "Launched" stat — earliest created timestamp across all versions (ns).
  // For global/provisioned apps this is the first published WASM version.
  // For BYOC apps, all_versions contains a single synthetic "external" summary
  // whose `created` is the initial register_external_canister time.
  const launchedAtNs = allVersions.reduce<bigint>((min, v) => {
    if (!v.created) return min;
    return min === 0n || v.created < min ? v.created : min;
  }, latestVersion.created ?? 0n);

  // Tool list/count sources:
  //   - Audit-sourced tools (tools_v1 attestation) give name + description + cost.
  //   - Usage-tracker tools (namespaceMetrics.total_tools) count tools observed
  //     at runtime. BYOC canisters have empty audit tools, so we fall back to
  //     the runtime count. Invocation-level tool names come from useNamespaceTools
  //     inside ToolsAndResources.
  const auditToolsCount = BigInt(latestVersion.tools?.length ?? 0);
  const runtimeToolsCount = namespaceMetrics?.total_tools ?? 0n;
  const totalToolsCount =
    auditToolsCount > 0n ? auditToolsCount : runtimeToolsCount;
  const seoDescription =
    server.description?.trim() ||
    `${server.name} is an Internet Computer app listed on the Prometheus Protocol App Store with ${tierInfo.name.toLowerCase()} status.`;

  return (
    <>
      <Seo
        title={server.name}
        description={seoDescription.slice(0, 160)}
        canonicalPath={`/app/${server.namespace}`}
        image={server.bannerUrl || server.iconUrl || '/images/prometheus.webp'}
      />
      <div className="w-full max-w-6xl mx-auto pt-12 pb-32">
        {/* Breadcrumbs - stays at the top, full width */}
        <nav className="text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-200">App Info</span>
        </nav>

        {/* Split columns from here down */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-16 gap-y-8">
          {/* Left column - Main content */}
          <main className="lg:col-span-3 space-y-16">
            {/* App Title and Info */}
            <div className="space-y-8">
              <h1 className="text-4xl font-bold tracking-tight">
                {server.name}
              </h1>

              <div className="flex flex-wrap items-center gap-y-6 gap-x-6">
                {/* Publisher info */}
                <div className="flex gap-4 items-start">
                  <ImageWithFallback
                    src={server.iconUrl}
                    alt={`${server.name} icon`}
                    className="w-11 h-11 rounded-md"
                  />
                  <div>
                    <span className="text-md font-bold">
                      {server.publisher}
                    </span>
                    <p className="text-xs text-muted-foreground italic">
                      App publisher
                    </p>
                  </div>
                </div>

                <div className="hidden h-12 w-px bg-border sm:block" />

                {/* Tier info */}
                <div className="flex items-start gap-4">
                  <div className="border border-gray-700 w-11 h-11 rounded-md flex items-center justify-center">
                    <tierInfo.Icon
                      className={cn('w-8 h-8', tierInfo.textColorClass)}
                    />
                  </div>
                  <div>
                    <span className="text-md font-bold">{tierInfo.name}</span>
                    <Link
                      to={`/certificate/${server.namespace}`}
                      className="text-xs text-muted-foreground italic hover:underline">
                      <p>{tierInfo.description}</p>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Stats Strip */}
              <StatsStrip
                launchedAtNs={launchedAtNs}
                totalTools={totalToolsCount}
                totalInvocations={displayMetrics?.total_invocations ?? 0n}
              />

              {/* Connection/Provision Info */}
              {isProvisionedApp && !resolvedCanisterId ? (
                <ProvisionInstance
                  namespace={server.namespace}
                  onProvisionClick={handleProvisionClick}
                  isProvisioning={provisionMutation.isPending}
                  isPollingForCanister={isPollingForCanister}
                />
              ) : (
                <ConnectionInfo
                  namespace={server.namespace}
                  allVersions={server.allVersions}
                  latestVersion={server.latestVersion}
                  onConnectClick={handleInstallClick}
                  isArchived={isViewingArchivedVersion}
                  canisterId={
                    isByoc ? undefined : (resolvedCanisterId ?? undefined)
                  }
                  onUpgradeClick={handleUpgradeClick}
                  isUpgrading={provisionMutation.isPending}
                  isPollingForCanister={isPollingForCanister}
                />
              )}
            </div>
            {/* Conditionally render the new container component */}

            <AboutSection server={server} />

            {/* Tools and Resources — shown when either audit-sourced tools
                (tools_v1 attestation) or runtime-tracked tools from the
                usage tracker exist. BYOC apps have no audit attestation but
                may have runtime tools observed via log_call. */}
            <ToolsAndResources
              tools={latestVersion.tools}
              namespace={server.namespace}
            />

            {hasDataSafetyInfo && (
              <DataSafetySection safetyInfo={latestVersion.dataSafety!} />
            )}

            <AccessAndBilling
              latestVersion={server.latestVersion}
              canisterId={resolvedCanisterId ?? undefined}
            />

            {isByoc ? (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
                <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Externally managed
                  </span>
                  {' — '}
                  This server is deployed and upgraded directly by the
                  developer. Prometheus Protocol does not control its canister
                  or WASM lifecycle.
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Version
                  </label>
                  <div className="mt-2">
                    <VersionSelector
                      allVersions={allVersions}
                      currentVersionWasmId={latestVersion.wasmId}
                      namespace={server.namespace}
                      canisterId={resolvedCanisterId ?? undefined}
                    />
                  </div>
                </div>

                {/* WASM Hash Verification Details (for development/debugging) */}
                {resolvedCanisterId && !isPollingForCanister && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Developer Information
                    </label>
                    <div className="mt-2">
                      <WasmHashDetails
                        canisterId={resolvedCanisterId}
                        expectedWasmId={latestVersion.wasmId}
                        namespace={server.namespace}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </main>

          {/* Right column - Sidebar */}
          <aside className="lg:col-span-2 space-y-8">
            <MediaGallery images={server.galleryImages} appName={server.name} />
            <SimilarApps currentServerNamespace={server.namespace} />
            {identity && resolvedCanisterId && (
              <AppTokenSection
                targetPrincipal={resolvedCanisterId}
                isOwnerOrDeveloper={isOwnerOrDeveloper}
                appName={server.name}
              />
            )}
          </aside>
        </div>
      </div>

      {/* Dialogs now receive the correct, version-specific wasmId. */}
      {/* <CreateBountyDialog
        isOpen={isBountyDialogOpen}
        onOpenChange={setIsBountyDialogOpen}
        wasmId={latestVersion.wasmId}
        auditType="app_info_v1"
        paymentToken={Tokens.USDC}
      /> */}

      {/* InstallDialog takes the whole object and will need to be updated internally. */}
      {resolvedCanisterId && (
        <InstallDialog
          server={server}
          canisterId={resolvedCanisterId}
          open={dialogState === 'install'}
          onOpenChange={(open) => !open && setDialogState('closed')}
        />
      )}

      <AlertDialog
        open={dialogState === 'confirm'}
        onOpenChange={(open) => !open && setDialogState('closed')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Connect to an Unverified Server?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This server, <span className="font-bold">{server.name}</span>, is
              not verified or audited by Prometheus Protocol. If it is BYOC, the
              developer controls the canister, code, upgrades, and operations.
              Proceed with caution.
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
