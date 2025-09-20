// src/components/server-details/ConnectionInfo.tsx

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Usb, ShieldCheck } from 'lucide-react';
import {
  AppVersionDetails,
  AppVersionSummary,
} from '@prometheus-protocol/ic-js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

interface ConnectionInfoProps {
  namespace: string;
  allVersions: AppVersionSummary[];
  latestVersion: AppVersionDetails;
  onConnectClick: () => void;
  isArchived?: boolean;
}

export function ConnectionInfo({
  namespace,
  allVersions,
  latestVersion,
  onConnectClick,
  isArchived,
}: ConnectionInfoProps) {
  const navigate = useNavigate();

  const handleViewCertClick = () => {
    const latestWasmId = allVersions[0]?.wasmId;
    const isViewingLatest = latestVersion.wasmId === latestWasmId;
    navigate(
      isViewingLatest
        ? `/certificate/${namespace}`
        : `/certificate/${namespace}/${latestVersion.wasmId}`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="pt-2 flex items-center gap-4 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold min-w-[150px]"
                  onClick={onConnectClick}
                  disabled={isArchived} // Use the new prop here
                >
                  <Usb className="mr-2 h-5 w-5" />
                  Connect
                </Button>
              </span>
            </TooltipTrigger>
            {isArchived && (
              <TooltipContent>
                <p>You can only connect to the latest version of an app.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Button
          onClick={handleViewCertClick}
          variant="ghost"
          className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck />
          View security certificate
        </Button>
      </div>
    </div>
  );
}
