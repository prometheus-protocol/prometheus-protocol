// src/components/app-details/ProvisionInstance.tsx

import { Button } from '@/components/ui/button';
import { Rocket, Loader2 } from 'lucide-react';

interface ProvisionInstanceProps {
  namespace: string;
  onProvisionClick: (namespace: string) => void;
  isProvisioning?: boolean;
  isPollingForCanister?: boolean;
}

export function ProvisionInstance({
  namespace,
  onProvisionClick,
  isProvisioning = false,
  isPollingForCanister = false,
}: ProvisionInstanceProps) {
  // Determine the current state and button text
  const isAnyOperationActive = isProvisioning || isPollingForCanister;

  const getButtonText = () => {
    if (isProvisioning) return 'Provisioning...';
    if (isPollingForCanister) return 'Preparing Instance...';
    return 'Launch Instance';
  };

  const getButtonIcon = () => {
    if (isAnyOperationActive) {
      return <Loader2 className="mr-2 h-5 w-5 animate-spin" />;
    }
    return <Rocket className="mr-2 h-5 w-5" />;
  };

  const getDescription = () => {
    if (isPollingForCanister) {
      return 'Your canister is being deployed and verified. This may take a few moments while we ensure everything is properly configured...';
    }
    return 'This application is designed to run as a private instance. Launch your own dedicated canister that you will own and control.';
  };

  return (
    <div className="mt-12 p-6 border rounded-lg bg-card/50">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isAnyOperationActive ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Rocket className="w-8 h-8 text-primary" />
            )}
          </div>
        </div>
        <div className="flex-grow">
          <h3 className="text-lg font-semibold">Private Instance</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {getDescription()}
          </p>
        </div>
        <div className="flex-shrink-0">
          <Button
            onClick={() => onProvisionClick(namespace)}
            size="lg"
            disabled={isAnyOperationActive}>
            {getButtonIcon()}
            {getButtonText()}
          </Button>
        </div>
      </div>
    </div>
  );
}
