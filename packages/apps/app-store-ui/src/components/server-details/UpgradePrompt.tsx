import { Principal } from '@icp-sdk/core/principal';
import { AppVersionSummary } from '@prometheus-protocol/ic-js';
import { useInstalledVersion } from '@/hooks/useInstalledVersion';
import { Button } from '@/components/ui/button';
import { ArrowUp, Loader2, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface UpgradePromptProps {
  canisterId: Principal | undefined;
  allVersions: AppVersionSummary[];
  namespace: string;
  onUpgradeClick?: () => void;
  isUpgrading?: boolean;
  isPollingForCanister?: boolean;
}

export function UpgradePrompt({
  canisterId,
  allVersions,
  namespace,
  onUpgradeClick,
  isUpgrading,
  isPollingForCanister,
}: UpgradePromptProps) {
  const { installedVersion, isLoading, isError } = useInstalledVersion(
    canisterId,
    allVersions,
  );

  const latestVersion = allVersions[0];

  if (!canisterId || !latestVersion || isLoading) {
    return null;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Unable to check for updates</AlertTitle>
        <AlertDescription>
          Could not verify the current version installed on the canister.
        </AlertDescription>
      </Alert>
    );
  }

  if (!installedVersion) {
    if (isPollingForCanister) {
      return (
        // REFACTOR: Added blue informational coloring
        <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200 [&>svg]:text-blue-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Verifying Deployment</AlertTitle>
          <AlertDescription>
            Checking canister version and verifying deployment integrity...
          </AlertDescription>
        </Alert>
      );
    }

    return (
      // REFACTOR: Added yellow warning coloring
      <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 [&>svg]:text-yellow-500">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Version Unknown</AlertTitle>
        <AlertDescription>
          Could not detect which version is currently installed on the canister.
        </AlertDescription>
      </Alert>
    );
  }

  const isUpgradeAvailable = installedVersion.wasmId !== latestVersion.wasmId;

  if (!isUpgradeAvailable) {
    return null;
  }

  // Show verifying state if currently polling after upgrade
  if (isPollingForCanister) {
    return (
      <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200 [&>svg]:text-blue-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Verifying Upgrade</AlertTitle>
        <AlertDescription>
          Checking new canister version and verifying upgrade integrity...
        </AlertDescription>
      </Alert>
    );
  }

  // Determine if button should be in loading state
  const isProcessing = isUpgrading || isPollingForCanister;

  // This is an actionable prompt, so a custom div is still the best choice here.
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowUp className="h-4 w-4 text-primary-600 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium mb-1">Update Available</div>
            <div className="text-xs text-muted-foreground">
              {installedVersion.versionString && latestVersion.versionString ? (
                <span>
                  v{installedVersion.versionString} → v
                  {latestVersion.versionString}
                </span>
              ) : (
                <span>
                  {installedVersion.securityTier} → {latestVersion.securityTier}
                </span>
              )}
            </div>
          </div>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onUpgradeClick}
                size="sm"
                disabled={isProcessing}>
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <ArrowUp className="w-3 h-3 mr-1" />
                )}
                {isProcessing ? 'Upgrading...' : 'Upgrade'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upgrade to the latest version</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
