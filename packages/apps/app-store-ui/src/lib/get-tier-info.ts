import { FeaturedServer } from './mock-data';
import { ShieldCheck, ShieldQuestion, ShieldOff } from 'lucide-react';

export interface TierInfo {
  name: string;
  overallScore?: number;
  description: string;
  textColorClass: string;
  borderColorClass: string;
  Icon: React.ElementType;
  mascotText: string;
}

export const getTierInfo = (server: FeaturedServer): TierInfo => {
  const score = server.certificate?.overallScore;

  if (score === undefined || score === null) {
    return {
      name: 'Community Tier',
      overallScore: 0,
      description: 'This app has not been audited by Prometheus Protocol.',
      textColorClass: 'text-muted-foreground',
      borderColorClass: 'border-border',
      Icon: ShieldQuestion,
      mascotText:
        "Just a heads-up! This one's from the community and hasn't been audited by us yet.",
    };
  }

  if (score >= 90) {
    return {
      name: 'Gold Verified',
      overallScore: score,
      description: 'Outstanding security audit score!',
      textColorClass: 'text-primary',
      borderColorClass: 'border-primary/50',
      Icon: ShieldCheck,
      mascotText:
        'Top-tier! This app passed our most rigorous security checks with flying colors.',
    };
  }
  if (score >= 75) {
    return {
      name: 'Silver Verified',
      overallScore: score,
      description: 'Solid security and performance.',
      textColorClass: 'text-slate-400',
      borderColorClass: 'border-slate-400/50',
      Icon: ShieldCheck,
      mascotText:
        'A solid and trustworthy choice. This app passed all our key checks with good marks.',
    };
  }
  if (score >= 60) {
    return {
      name: 'Bronze Verified',
      overallScore: score,
      description: 'Meets all essential security criteria.',
      textColorClass: 'text-amber-600',
      borderColorClass: 'border-amber-600/50',
      Icon: ShieldCheck,
      mascotText:
        "This app meets all the essential safety standards. You're good to go!",
    };
  }

  return {
    name: 'Verification Failed',
    overallScore: score,
    description: 'This app did not meet the minimum audit score.',
    textColorClass: 'text-destructive',
    borderColorClass: 'border-destructive/50',
    Icon: ShieldOff,
    mascotText:
      "Looks like this one didn't pass the audit. It's best to wait for a new version.",
  };
};
