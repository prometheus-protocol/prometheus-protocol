import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeaturedServer } from '@/lib/mock-data';
import { getTierInfo } from '@/lib/get-tier-info';

interface ServerCardProps {
  server: FeaturedServer;
}

export function ServerCard({ server }: ServerCardProps) {
  const tierInfo = getTierInfo(server);

  return (
    <Link
      to={`/server/${server.id}`}
      className="flex items-center gap-4 p-2 md:p-3 rounded-3xl hover:bg-accent transition-colors group">
      <img
        src={server.iconUrl}
        alt={`${server.name} icon`}
        className="w-16 h-16 rounded-xl object-cover"
      />
      <div className="flex-1">
        <h3 className="font-semibold group-hover:underline">{server.name}</h3>
        <p className="text-sm text-muted-foreground">{server.category}</p>

        {tierInfo && (
          <div className="flex items-center mt-1">
            <tierInfo.Icon className={cn('w-4 h-4', tierInfo.textColorClass)} />
          </div>
        )}
      </div>
    </Link>
  );
}
