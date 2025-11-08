import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PromoBadge } from './ui/promo-badge';
import { AppStoreListing } from '@prometheus-protocol/ic-js';
import { ImageWithFallback } from '@/components/ui/image-with-fallback'; // 1. Import the fallback component

interface FeaturedServerCardProps {
  server: AppStoreListing;
}

const statusMap: Record<string, string> = {
  Unranked: 'Coming Soon',
  Gold: 'Recommended',
};

export function FeaturedServerCard({ server }: FeaturedServerCardProps) {
  // This logic is fine, an "Unranked" tier can be considered "Coming Soon" in terms of full certification.
  const status = server.latestVersion.securityTier;

  return (
    <Link to={`/app/${server.namespace}`} className="block group">
      <Card className="overflow-hidden border-transparent transition-all p-0">
        <CardContent className="p-0">
          <div className="relative overflow-hidden rounded-4xl">
            {/* 2. Replace the banner image */}
            <ImageWithFallback
              src={server.bannerUrl}
              alt={`${server.name} banner`}
              className="
                aspect-[16/10] w-full object-cover
                transition-transform duration-500 ease-in-out
                scale-[1.01] group-hover:scale-105
              "
            />
            <PromoBadge className="md:py-3 py-2 pt-3 px-4 pr-5 md:text-xs">
              {statusMap[status] ?? status}
            </PromoBadge>
          </div>
          <div className="py-4 flex items-start gap-3 bg-card">
            {/* 3. Replace the icon image */}
            <ImageWithFallback
              src={server.iconUrl}
              alt={`${server.name} icon`}
              className="w-12 h-12 rounded-md object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{server.name}</h3>
              <p className="text-sm text-muted-foreground">{server.category}</p>
            </div>
            <Button variant="secondary" size="sm">
              {status === 'Gold' ? 'Connect' : 'Details'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
