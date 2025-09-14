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

interface VersionSelectorProps {
  allVersions: AppVersionSummary[];
  currentVersionWasmId: string;
  namespace: string;
}

export function VersionSelector({
  allVersions,
  currentVersionWasmId,
  namespace,
}: VersionSelectorProps) {
  const navigate = useNavigate();

  // The latest version is always the first in the sorted list from the canister.
  const latestVersionWasmId = allVersions[0]?.wasmId;

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
      <SelectTrigger className="w-full sm:w-[280px] text-left">
        <SelectValue placeholder="Select a version" />
      </SelectTrigger>
      <SelectContent>
        {allVersions.map((version, index) => {
          const tierInfo = getTierInfo(version.securityTier);
          const isLatest = index === 0;

          return (
            <SelectItem key={version.wasmId} value={version.wasmId}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <tierInfo.Icon
                    className={cn('w-4 h-4', tierInfo.textColorClass)}
                  />
                  <span className="font-mono">{version.versionString}</span>
                  <span className="text-muted-foreground">
                    ({version.securityTier})
                  </span>
                </div>
                {isLatest && (
                  <Badge variant="outline" className="ml-4">
                    Latest
                  </Badge>
                )}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
