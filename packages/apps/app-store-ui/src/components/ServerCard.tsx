import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getTierInfo } from '@/lib/get-tier-info';
import { AppStoreListing } from '@prometheus-protocol/ic-js';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { Badge } from '@/components/ui/badge'; // Import the Badge component
import { ShieldCheck } from 'lucide-react';

interface AppCardProps {
  app: AppStoreListing;
}

export function ServerCard({ app }: AppCardProps) {
  const tierInfo = getTierInfo(app.latestVersion.securityTier);

  return (
    <Link
      to={`/app/${app.namespace}`}
      className="flex items-center gap-4 p-3 rounded-2xl hover:bg-accent transition-colors group border border-transparent hover:border-primary/20">
      <ImageWithFallback
        src={app.iconUrl}
        alt={`${app.name} icon`}
        className="w-18 h-18 rounded-xl object-cover flex-shrink-0"
      />
      <div className="flex-1 flex flex-col items-start">
        <h3 className="font-semibold group-hover:underline">{app.name}</h3>

        {/* 1. Add the publisher for more context */}
        <p className="text-xs text-muted-foreground mb-2">by {app.publisher}</p>

        {/* 2. Use a proper, contextual status badge */}
        <div className="mr-1.5">
          {app.latestVersion.status === 'Pending' ? (
            // --- Badge for PENDING apps ---
            <Badge
              variant="secondary"
              className="text-xs bg-grey-900/50 border-grey-700 text-grey-300">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Build Verified
            </Badge>
          ) : (
            // --- Badge for LISTED apps ---
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                tierInfo.borderColorClass,
                tierInfo.textColorClass,
              )}>
              <tierInfo.Icon className="h-3 w-3 mr-1" />
              {tierInfo.name}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
