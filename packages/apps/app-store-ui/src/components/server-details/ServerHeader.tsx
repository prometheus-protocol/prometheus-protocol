import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Coins, Usb } from 'lucide-react';
import { MediaGallery } from './MediaGallery';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { AppStoreDetails } from '@prometheus-protocol/ic-js';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';
import { VersionSelector } from './VersionSelector';

interface ServerHeaderProps {
  server: AppStoreDetails;
  onInstallClick: () => void;
  onSponsorClick: () => void;
}

export function ServerHeader({
  server,
  onInstallClick,
  onSponsorClick,
}: ServerHeaderProps) {
  const { latestVersion } = server;
  const tierInfo = getTierInfo(latestVersion.securityTier);
  const navigate = useNavigate();

  const handleViewCertClick = () => {
    // The absolute latest version is always the first in the sorted `allVersions` array.
    const latestWasmId = server.allVersions[0]?.wasmId;

    // Check if the version we are currently viewing is the latest one.
    const isViewingLatest = latestVersion.wasmId === latestWasmId;

    if (isViewingLatest) {
      // If it's the latest, use the clean, canonical URL without a hash.
      navigate(`/certificate/${server.namespace}`);
    } else {
      // If it's an older version, we MUST include its specific wasmId in the URL.
      navigate(`/certificate/${server.namespace}/${latestVersion.wasmId}`);
    }
  };

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

          {/* Check the status from the nested latestVersion object */}
          {latestVersion.status === 'Pending' ? (
            // --- UI for PENDING apps ---
            <>
              <div className="mt-10 flex flex-wrap items-center gap-y-6 gap-x-6">
                <div className="flex gap-4 items-start">
                  <ImageWithFallback
                    src={server.iconUrl}
                    alt={`${server.name} icon`}
                    className="w-11 h-11 rounded-md"
                  />
                  <div>
                    <span className="text-md font-bold">
                      {server.publisher}
                    </span>
                    <p className="text-xs text-muted-foreground italic">
                      Developer Submission
                    </p>
                  </div>
                </div>
                <div className="hidden h-12 w-px bg-border sm:block" />
                <div className="flex items-start gap-4">
                  <div className="border border-green-700/50 w-11 h-11 rounded-md flex items-center justify-center">
                    <ShieldCheck className="w-8 h-8 text-green-400" />
                  </div>
                  <div>
                    <span className="text-md font-bold">Build Verified</span>
                    <p className="text-xs text-muted-foreground italic">
                      Source code has been successfully reproduced.
                    </p>
                  </div>
                </div>
              </div>
              <div className="max-w-lg mt-8 text-sm text-amber-300/80 bg-amber-900/30 border border-amber-500/30 rounded-md p-3">
                This app is coming soon! Sponsor the listing audit to get it
                fully reviewed and published on the store.
              </div>
              <div className="mt-8 flex items-center gap-4">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold min-w-[150px]"
                  onClick={onSponsorClick}>
                  <Coins className="mr-2 h-5 w-5" />
                  Sponsor Listing
                </Button>
              </div>
            </>
          ) : (
            // --- UI for LISTED apps ---
            <>
              <div className="mt-10 flex flex-wrap items-center gap-y-6 gap-x-6">
                <div className="flex gap-4 items-start">
                  <ImageWithFallback
                    src={server.iconUrl}
                    alt={`${server.name} icon`}
                    className="w-11 h-11 rounded-md"
                  />
                  <div>
                    <span className="text-md font-bold">
                      {server.publisher}
                    </span>
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

              {/* --- VERSION SELECTOR INTEGRATION --- */}
              <div className="mt-8">
                <label className="text-sm font-medium text-muted-foreground">
                  Version
                </label>
                <div className="mt-2">
                  <VersionSelector
                    allVersions={server.allVersions}
                    currentVersionWasmId={latestVersion.wasmId}
                    namespace={server.namespace}
                  />
                </div>
              </div>

              <div className="mt-12 flex items-center gap-4 flex-wrap">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold min-w-[150px]"
                  onClick={onInstallClick}>
                  <Usb />
                  Connect
                </Button>
                <Button
                  onClick={handleViewCertClick}
                  variant="ghost"
                  className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck />
                  View security certificate
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col">
          <MediaGallery images={server.galleryImages} appName={server.name} />
        </div>
      </div>
    </header>
  );
}
