import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
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
  const navigate = useNavigate();

  const handleViewCertClick = () => {
    navigate('./certificate');
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

          <div className="mt-10 flex flex-wrap items-center gap-y-6 gap-x-6">
            <div className="flex gap-4 items-start">
              {/* --- USE THE FALLBACK COMPONENT --- */}
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
                  to={'./certificate'}
                  className="text-xs text-muted-foreground italic hover:underline">
                  <p>{tierInfo.description}</p>
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
              onClick={handleViewCertClick}
              variant="ghost"
              className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck />
              View security certificate
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
