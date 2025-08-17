import { Link } from 'react-router-dom';
import { allServers } from '@/lib/mock-data';
import { getTierInfo } from '@/lib/get-tier-info';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimilarAppsProps {
  currentServerId: string;
}

export function SimilarApps({ currentServerId }: SimilarAppsProps) {
  // Use `allServers` to have access to the certificate data
  const similarApps = allServers
    .filter((server) => server.id !== currentServerId)
    .slice(0, 3);

  if (similarApps.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight mt-10 mb-5">
        Similar apps
      </h2>
      <div className="space-y-2">
        {similarApps.map((app) => {
          // 3. Get the dynamic tier info for each app
          const tierInfo = getTierInfo(app);

          return (
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

              {/* 4. Conditionally render the shield ONLY if the app is certified */}
              {tierInfo && (
                <ShieldCheck
                  className={cn('w-5 h-5', tierInfo.textColorClass)}
                />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
