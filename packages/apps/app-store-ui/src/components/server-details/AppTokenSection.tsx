import React from 'react';
import { Principal } from '@dfinity/principal';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { TokenManager } from '../TokenManager';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { Section } from '../Section';
import { Wallet } from 'lucide-react';

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
      <Section title="Token Management" icon={<Wallet className="h-5 w-5" />}>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </Section>
    );
  }

  if (error) {
    return (
      <Section title="Token Management" icon={<Wallet className="h-5 w-5" />}>
        <div className="text-red-500 p-4 border border-red-500/20 rounded-lg bg-red-500/5">
          Failed to load token registry: {error}
        </div>
      </Section>
    );
  }

  return (
    <Section title="Token Management" icon={<Wallet className="h-5 w-5" />}>
      <div className="space-y-6">
        {/* Token Allowances - Always visible for logged-in users */}
        <TokenManager mode="allowance" targetPrincipal={targetPrincipal} />

        {/* Canister Wallet - Only visible for owners/developers */}
        {isOwnerOrDeveloper && (
          <TokenManager
            mode="balance"
            targetPrincipal={targetPrincipal}
            showPrincipalId={true}
            principalIdLabel="App Canister Principal ID"
            principalIdDescription="Send tokens to this address to top up the app's balance"
          />
        )}
      </div>
    </Section>
  );
};
