import React from 'react';
import { Principal } from '@icp-sdk/core/principal';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { Section } from '../Section';
import { Wallet } from 'lucide-react';
import { TokenManager } from '../token-manager';

interface AppTokenSectionProps {
  targetPrincipal: Principal;
  isOwnerOrDeveloper: boolean;
  appName: string;
}

export const AppTokenSection: React.FC<AppTokenSectionProps> = ({
  targetPrincipal,
  isOwnerOrDeveloper,
}) => {
  const { identity } = useInternetIdentity();
  const { isLoading, error } = useTokenRegistry();

  // Don't render if user is not logged in
  if (!identity) {
    return null;
  }

  if (isLoading) {
    return (
      <Section title="Token Allowances" icon={<Wallet className="h-5 w-5" />}>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Token Allowances" icon={<Wallet className="h-5 w-5" />}>
        <div className="text-red-500 p-4 border border-red-500/20 rounded-lg bg-red-500/5">
          Failed to load token registry: {error}
        </div>
      </Section>
    );
  }

  return (
    <Section title="Token Allowances" icon={<Wallet className="h-5 w-5" />}>
      <div className="space-y-6">
        {/* Token Allowance Management - Always visible for logged-in users */}
        <TokenManager
          targetPrincipal={targetPrincipal}
          showPrincipalId={isOwnerOrDeveloper}
          principalIdLabel="App Canister Principal ID"
          principalIdDescription="This app's wallet address for receiving tokens"
        />
      </div>
    </Section>
  );
};
