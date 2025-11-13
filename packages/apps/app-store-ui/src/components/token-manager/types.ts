import { Principal } from '@icp-sdk/core/principal';

export interface TokenManagerProps {
  targetPrincipal: Principal;
  showPrincipalId?: boolean;
  principalIdLabel?: string;
  principalIdDescription?: string;
}
