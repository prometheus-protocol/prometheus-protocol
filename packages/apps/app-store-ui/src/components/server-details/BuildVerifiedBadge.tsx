import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

export const BuildVerifiedBadge = () => {
  return (
    <Badge
      variant="secondary"
      className="bg-green-900/50 border-green-700 text-green-300 py-2 px-3 text-sm">
      <ShieldCheck className="h-4 w-4 mr-2" />
      Build Verified
    </Badge>
  );
};
