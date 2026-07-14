import { AppStoreDetails } from '@prometheus-protocol/ic-js';
import {
  BadgeCheck,
  GitCompareArrows,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';

// The interface no longer has `overallScore` or `checklist`.
// It's purely for UI display based on a final tier.
export interface TierUiInfo {
  name: string;
  description: string;
  textColorClass: string;
  borderColorClass: string;
  Icon: React.ElementType;
  mascotText: string;
}

export const getTierInfo = (
  tier: AppStoreDetails['latestVersion']['securityTier'],
  status?: AppStoreDetails['latestVersion']['status'],
): TierUiInfo => {
  if (status === 'External') {
    return {
      name: 'Developer Managed',
      description:
        'Self-managed BYOC canister; not verified by Prometheus.',
      textColorClass: 'text-muted-foreground',
      borderColorClass: 'border-border',
      Icon: ShieldOff,
      mascotText:
        'This is BYOC. The developer manages the canister and code; Prometheus provides no guarantee.',
    };
  }

  if (tier === 'Gold') {
    return {
      name: 'Audited Verified Code',
      description:
        'Verified build plus point-in-time security audit.',
      textColorClass: 'text-primary',
      borderColorClass: 'border-primary/50',
      Icon: ShieldCheck,
      mascotText:
        'This version was reproducibly built and audited. It is still not a guarantee of safety.',
    };
  }

  if (tier === 'Silver' || tier === 'Bronze') {
    return {
      name: 'Verified Build',
      description:
        'Source rebuilt by verifier network; WASM hash matched.',
      textColorClass: tier === 'Silver' ? 'text-slate-400' : 'text-amber-600',
      borderColorClass:
        tier === 'Silver' ? 'border-slate-400/50' : 'border-amber-600/50',
      Icon: GitCompareArrows,
      mascotText:
        'The source/build output matches the deployed WASM. This is not a security audit.',
    };
  }

  if (tier === 'Unranked') {
    return {
      name: 'Unverified',
      description:
        'No reproducible-build proof or audit available.',
      textColorClass: 'text-muted-foreground',
      borderColorClass: 'border-border',
      Icon: BadgeCheck,
      mascotText:
        'No reproducible-build proof is available for this version. Treat it as unverified.',
    };
  }

  return {
    name: 'Unverified',
    description: 'This app has not been submitted for verification.',
    textColorClass: 'text-destructive',
    borderColorClass: 'border-destructive/50',
    Icon: ShieldOff,
    mascotText:
      "Looks like this one hasn't been submitted for verification yet.",
  };
};
