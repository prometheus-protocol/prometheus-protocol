import { Link } from 'react-router-dom';
import { featuredServers } from '@/lib/mock-data';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimilarAppsProps {
  currentServerId: string;
}

export function SimilarApps({ currentServerId }: SimilarAppsProps) {
  // Filter out the current server and take the first 3 alternatives
  const similarApps = featuredServers
    .filter((server) => server.id !== currentServerId)
    .slice(0, 3);

  if (similarApps.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight my-8">Similar apps</h2>
      <div className="space-y-2">
        {similarApps.map((app) => (
          <Link
            key={app.id}
            to={`/server/${app.id}`}
            className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-muted/50 -mx-2">
            <img
              src={app.iconUrl}
              alt={app.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1">
              <h3 className="font-semibold leading-tight">{app.name}</h3>
              <p className="text-sm text-muted-foreground">{app.category}</p>
            </div>
            <ShieldCheck
              className={cn('w-5 h-5', {
                'text-yellow-400': app.tier === 'gold',
                'text-gray-400': app.tier === 'silver',
                'text-yellow-700': app.tier === 'bronze',
              })}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
