import { Link } from 'react-router-dom';
import { MediaGallery } from './MediaGallery';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { AppStoreDetails } from '@prometheus-protocol/ic-js';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { ConnectionInfo } from './ConnectionInfo';
import { StatsStrip } from './StatsStrip';

interface ServerHeaderProps {
  server: AppStoreDetails;
  onInstallClick: () => void;
  isArchived?: boolean;
}

export function ServerHeader({
  server,
  onInstallClick,
  isArchived,
}: ServerHeaderProps) {
  const { latestVersion } = server;
  const tierInfo = getTierInfo(latestVersion.securityTier);
  const metrics = server.metrics;

  return (
    <header>
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">App Info</span>
      </nav>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-16">
        <div className="lg:col-span-3">
          <h1 className="text-4xl font-bold tracking-tight">{server.name}</h1>

          <div className="mt-10 flex flex-wrap items-center gap-y-6 gap-x-6 mb-8">
            <div className="flex gap-4 items-start">
              <ImageWithFallback
                src={server.iconUrl}
                alt={`${server.name} icon`}
                className="w-11 h-11 rounded-md"
              />
              <div>
                <span className="text-md font-bold">{server.publisher}</span>
                <p className="text-xs text-muted-foreground italic">
                  In-app transactions available
                </p>
              </div>
            </div>
            <div className="hidden h-12 w-px bg-border sm:block" />
            <div className="flex items-start gap-4">
              <div className="border border-gray-700 w-11 h-11 rounded-md flex items-center justify-center">
                <tierInfo.Icon
                  className={cn('w-8 h-8', tierInfo.textColorClass)}
                />
              </div>
              <div>
                <span className="text-md font-bold">{tierInfo.name}</span>
                <Link
                  to={`/certificate/${server.namespace}`}
                  className="text-xs text-muted-foreground italic hover:underline">
                  <p>{tierInfo.description}</p>
                </Link>
              </div>
            </div>
          </div>

          {/* --- 3. Conditionally render the StatsStrip component --- */}
          {/* It will only show up if the metrics object exists. */}
          <StatsStrip
            uniqueUsers={metrics?.uniqueUsers || 0n}
            totalTools={metrics?.totalTools || 0n}
            totalInvocations={metrics?.totalInvocations || 0n}
          />

          <ConnectionInfo
            namespace={server.namespace}
            allVersions={server.allVersions}
            latestVersion={server.latestVersion}
            onConnectClick={onInstallClick}
            isArchived={isArchived}
          />
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <MediaGallery images={server.galleryImages} appName={server.name} />
        </div>
      </div>
    </header>
  );
}
