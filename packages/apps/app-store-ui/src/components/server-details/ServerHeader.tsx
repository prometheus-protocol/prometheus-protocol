import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { MediaGallery } from './MediaGallery';
import { getTierInfo } from '@/lib/get-tier-info';
import { cn } from '@/lib/utils';
import { AppStoreDetails } from '@prometheus-protocol/ic-js';
import { ImageWithFallback } from '@/components/ui/image-with-fallback';

interface ServerHeaderProps {
  server: AppStoreDetails;
  onInstallClick: () => void;
}

// This is now a stateless presentation component.
export function ServerHeader({ server, onInstallClick }: ServerHeaderProps) {
  const tierInfo = getTierInfo(server.securityTier);

  return (
    <header>
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span>App Info</span>
      </nav>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-16">
        <div className="lg:col-span-3">
          <h1 className="text-4xl font-bold tracking-tight">{server.name}</h1>

          <div className="mt-10 flex flex-wrap items-center gap-y-4 gap-x-6">
            <div className="flex gap-2 items-start">
              {/* --- USE THE FALLBACK COMPONENT --- */}
              <ImageWithFallback
                src={server.iconUrl}
                alt={`${server.name} icon`}
                className="w-11 h-11 rounded-md"
              />
              <div>
                <span className="text-sm font-bold">{server.publisher}</span>
                <p className="text-xs text-muted-foreground italic">
                  In-app purchases available
                </p>
              </div>
            </div>

            <div className="hidden h-12 w-px bg-border sm:block" />

            <div className="flex items-start gap-2">
              <tierInfo.Icon
                className={cn('w-11 h-11', tierInfo.textColorClass)}
              />
              <div>
                <p className="text-sm font-bold">{tierInfo.name}</p>
                <Link
                  to={'./certificate'}
                  className="text-xs text-muted-foreground italic hover:underline">
                  View certificate
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 flex items-center gap-4">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold min-w-[150px]"
              onClick={onInstallClick} // <-- USE THE PROP
            >
              Install
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 text-muted-foreground">
              <Heart className="w-4 h-4" />
              Add to wishlist
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col justify-end">
          <MediaGallery images={server.galleryImages} appName={server.name} />
        </div>
      </div>
    </header>
  );
}
