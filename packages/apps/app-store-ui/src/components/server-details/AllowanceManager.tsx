import { useMemo } from 'react';
import { AppVersionDetails, Token, Tokens } from '@prometheus-protocol/ic-js';
import { Principal } from '@dfinity/principal';
import { TokenAllowanceItem } from './TokenAllowanceItem';

// --- 1. Updated Props ---
// The component now takes the AppVersionDetails object directly.
interface Props {
  latestVersion: AppVersionDetails;
  canisterId: Principal;
  onSuccess?: () => void;
}

export const AllowanceManager = ({ latestVersion, canisterId, onSuccess }: Props) => {
  const { tools } = latestVersion;
  const spenderPrincipal = canisterId;

  // --- 2. NEW: Token Discovery Logic ---
  // We derive the list of accepted tokens by parsing the tools list,
  // which is the single source of truth on this page.
  const availableTokens = useMemo(() => {
    if (!latestVersion.tools) return [];

    // Use a Set to find all unique ledger canister IDs from the tools list.
    const acceptedTokens = new Set<Token>();
    for (const tool of latestVersion.tools) {
      if (
        tool.tokenSymbol &&
        Tokens[tool.tokenSymbol] &&
        Number(tool.cost) > 0
      ) {
        acceptedTokens.add(Tokens[tool.tokenSymbol]);
      }
    }

    // Convert the Set to a stable array of Token objects.
    return Array.from(acceptedTokens);
  }, [latestVersion]);

  // --- 4. Conditional Rendering for No Paid Tools ---
  if (availableTokens.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground border rounded-lg">
        This application does not currently charge for tools.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {availableTokens.map((token) => (
        <TokenAllowanceItem
          key={token.symbol}
          token={token}
          spenderPrincipal={spenderPrincipal}
          onSuccess={onSuccess || (() => {})}
        />
      ))}
    </div>
  );
}
