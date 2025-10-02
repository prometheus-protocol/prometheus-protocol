import { Principal } from '@dfinity/principal';
import { AppVersionSummary } from '@prometheus-protocol/ic-js';
import { useInstalledVersion } from '@/hooks/useInstalledVersion';
import { Button } from '@/components/ui/button';
import { ArrowUp, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UpgradePromptProps {
  canisterId: Principal | undefined;
  allVersions: AppVersionSummary[];
  namespace: string;
  onUpgradeClick?: () => void;
  className?: string;
  isUpgrading?: boolean;
}

export function UpgradePrompt({
  canisterId,
  allVersions,
  namespace,
  onUpgradeClick,
  className,
  isUpgrading,
}: UpgradePromptProps) {
  const { installedVersion, isLoading, isError } = useInstalledVersion(
    canisterId,
    allVersions,
  );

  // Get the latest version (first in the array)
  const latestVersion = allVersions[0];

  if (!canisterId || !latestVersion || isLoading) {
    return null;
  }

  if (isError) {
    return (
      <div
        className={cn(
          'p-4 border border-orange-200 rounded-lg bg-orange-50',
          className,
        )}>
        <div className="flex items-center gap-2 text-orange-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Unable to check for updates
          </span>
        </div>
        <p className="text-sm text-orange-600 mt-1">
          Could not verify the current version installed on the canister.
        </p>
      </div>
    );
  }

  if (!installedVersion) {
    return (
      <div className={cn('p-4 border border-gray-200 rounded-lg', className)}>
        <div className="flex items-center gap-2 text-gray-600">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">Version Unknown</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Could not detect which version is currently installed on the canister.
        </p>
      </div>
    );
  }

  // Check if an upgrade is available
  const isUpgradeAvailable = installedVersion.wasmId !== latestVersion.wasmId;

  if (!isUpgradeAvailable) {
    return null;
  }

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    }
  };

  return (
    <div className={cn('p-4 border rounded-lg', className)}>
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
              <Button onClick={handleUpgrade} size="sm" disabled={isUpgrading}>
                {isUpgrading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <ArrowUp className="w-3 h-3 mr-1" />
                )}
                {isUpgrading ? 'Upgrading...' : 'Upgrade'}
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
