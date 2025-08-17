import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FeaturedServer } from '@/lib/mock-data';
import { PromoBadge } from './ui/promo-badge';

interface FeaturedServerCardProps {
  server: FeaturedServer;
}

export function FeaturedServerCard({ server }: FeaturedServerCardProps) {
  return (
    <Link to={`/server/${server.id}`} className="block group">
      <Card className="overflow-hidden border-transparent transition-all p-0">
        <CardContent className="p-0">
          <div className="relative overflow-hidden rounded-3xl">
            <img
              src={server.bannerUrl}
              alt={`${server.name} banner`}
              className="
                aspect-[16/9] w-full object-cover
                transition-transform duration-500 ease-in-out
                group-hover:scale-105
              "
            />
            <PromoBadge className="md:py-2 md:px-4 md:text-xs">
              {server.status}
            </PromoBadge>
          </div>
          <div className="py-4 flex items-start gap-3 bg-card">
            <img
              src={server.iconUrl}
              alt={`${server.name} icon`}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{server.name}</h3>
              <p className="text-sm text-muted-foreground">{server.category}</p>
            </div>
            <Button variant="outline" size="sm">
              {server.status === 'Now Available' ? 'Install' : 'Details'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
