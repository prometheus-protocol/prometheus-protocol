import { Principal } from '@icp-sdk/core/principal';
import { Token } from '@prometheus-protocol/ic-js';

export interface TokenManagerProps {
  targetPrincipal: Principal;
  showPrincipalId?: boolean;
  principalIdLabel?: string;
  principalIdDescription?: string;
  onDeposit?: (token: Token) => void;
  onWithdraw?: (token: Token, canisterPrincipal: Principal) => void;
}
