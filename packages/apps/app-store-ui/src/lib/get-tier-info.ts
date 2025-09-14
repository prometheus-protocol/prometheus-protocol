import { AppStoreDetails } from '@prometheus-protocol/ic-js';
import { ShieldCheck, ShieldQuestion, ShieldOff } from 'lucide-react';

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
): TierUiInfo => {
  if (tier === 'Gold') {
    return {
      name: 'Gold Verified',
      description: 'Passed all available audits.',
      textColorClass: 'text-primary',
      borderColorClass: 'border-primary/50',
      Icon: ShieldCheck,
      mascotText:
        'Top-tier! This app passed our most rigorous security checks.',
    };
  }
  if (tier === 'Silver') {
    return {
      name: 'Silver Verified',
      description: 'Has a reproducible build and verified tools.',
      textColorClass: 'text-slate-400',
      borderColorClass: 'border-slate-400/50',
      Icon: ShieldCheck,
      mascotText: 'A solid and trustworthy choice that passed our key checks.',
    };
  }
  if (tier === 'Bronze') {
    return {
      name: 'Bronze Verified',
      description: 'Has a reproducible build and verified app info.',
      textColorClass: 'text-amber-600',
      borderColorClass: 'border-amber-600/50',
      Icon: ShieldCheck,
      mascotText: 'This app meets the essential safety standards.',
    };
  }
  if (tier === 'Unranked') {
    return {
      name: 'Community Tier',
      description: 'Provides app info but has not been fully audited.',
      textColorClass: 'text-muted-foreground',
      borderColorClass: 'border-border',
      Icon: ShieldQuestion,
      mascotText:
        "This one's from the community and hasn't been fully audited yet.",
    };
  }

  // Default fallback for any unexpected state.
  return {
    name: 'Unverified',
    description: 'This app has not been submitted for verification.',
    textColorClass: 'text-destructive',
    borderColorClass: 'border-destructive/50',
    Icon: ShieldOff,
    mascotText: "Looks like this one hasn't been submitted for an audit yet.",
  };
};
