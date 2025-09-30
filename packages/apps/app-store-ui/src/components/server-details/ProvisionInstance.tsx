// src/components/app-details/ProvisionInstance.tsx

import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

interface ProvisionInstanceProps {
  namespace: string;
  onProvisionClick: (namespace: string) => void;
  isProvisioning?: boolean;
}

export function ProvisionInstance({
  namespace,
  onProvisionClick,
  isProvisioning = false,
}: ProvisionInstanceProps) {
  return (
    <div className="mt-12 p-6 border rounded-lg bg-card/50">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="flex-grow">
          <h3 className="text-lg font-semibold">Private Instance</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This application is designed to run as a private instance. Launch
            your own dedicated canister that you will own and control.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Button
            onClick={() => onProvisionClick(namespace)}
            size="lg"
            disabled={isProvisioning}>
            <Rocket className="mr-2 h-5 w-5" />
            {isProvisioning ? 'Provisioning...' : 'Launch Instance'}
          </Button>
        </div>
      </div>
    </div>
  );
}
