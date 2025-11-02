import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppVersionSummary } from '@prometheus-protocol/ic-js';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/badge';
import { useInstalledVersion } from '@/hooks/useInstalledVersion';
import { Principal } from '@icp-sdk/core/principal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VersionSelectorProps {
  allVersions: AppVersionSummary[];
  currentVersionWasmId: string;
  namespace: string;
  canisterId?: Principal; // Add canisterId to detect installed version
}

export function VersionSelector({
  allVersions,
  currentVersionWasmId,
  namespace,
  canisterId,
}: VersionSelectorProps) {
  const navigate = useNavigate();

  // The latest version is always the first in the sorted list from the canister.
  const latestVersionWasmId = allVersions[0]?.wasmId;

  // Get the currently installed version from the canister
  const { installedVersion } = useInstalledVersion(canisterId, allVersions);

  const isViewingInstalledVersion =
    installedVersion?.wasmId === currentVersionWasmId;

  const handleVersionChange = (selectedWasmId: string) => {
    // If the user selects the latest version, navigate to the clean, canonical URL.
    // Otherwise, navigate to the URL with the specific version hash.
    if (selectedWasmId === latestVersionWasmId) {
      navigate(`/app/${namespace}`);
    } else {
      navigate(`/app/${namespace}/${selectedWasmId}`);
    }
  };

  return (
    <Select
      onValueChange={handleVersionChange}
      defaultValue={currentVersionWasmId}>
      <SelectTrigger className="w-full sm:w-[360px] text-left">
        <div className="flex items-center justify-between w-full">
          <SelectValue placeholder="Select a version" />
          {installedVersion && !isViewingInstalledVersion && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="bg-blue-100 text-blue-800 border-blue-200 text-xs ml-2">
                    v{installedVersion.versionString} installed
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Version {installedVersion.versionString} is currently
                    deployed on the canister
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {allVersions.map((version, index) => {
          const tierInfo = getTierInfo(version.securityTier);
          const isLatest = index === 0;
          const isInstalled = installedVersion?.wasmId === version.wasmId;

          return (
            <SelectItem key={version.wasmId} value={version.wasmId}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <tierInfo.Icon
                    className={cn('w-4 h-4', tierInfo.textColorClass)}
                  />
                  <span className="font-mono">{version.versionString}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(
                      Number(version.created / 1_000_000n),
                    ).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {isLatest && <Badge variant="outline">Latest</Badge>}
                  {isInstalled && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800 border-blue-200">
                            Installed
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            This version is currently deployed on the canister
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
