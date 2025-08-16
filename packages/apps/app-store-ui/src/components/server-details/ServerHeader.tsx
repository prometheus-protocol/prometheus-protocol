import { Link } from 'react-router-dom';
import { FeaturedServer } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Heart, Award } from 'lucide-react';
import { MediaGallery } from './MediaGallery'; // <-- 1. Import the MediaGallery
import { useState } from 'react';
import { InstallDialog } from './InstallDialog';

interface ServerHeaderProps {
  server: FeaturedServer;
}

export function ServerHeader({ server }: ServerHeaderProps) {
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);

  return (
    <>
      <header>
        <nav className="text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span>App Info</span>
        </nav>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-16">
          {/* 3. Left Column: Details & Actions */}
          <div className="lg:col-span-3">
            <h1 className="text-4xl font-bold tracking-tight">{server.name}</h1>

            <div
              className="
              mt-10 flex flex-wrap items-center gap-y-4 
              divide-x divide-border gap-x-6
            ">
              {/* First Item (no divider before it) */}
              <div className="flex gap-2 items-start pr-6">
                <img
                  src={server.iconUrl}
                  alt={`${server.name} icon`}
                  className="w-11 h-11 rounded-md"
                />
                <div>
                  <span className="text-sm font-bold">{server.category}</span>
                  <p className="text-xs text-muted-foreground italic">
                    In-app purchases available
                  </p>
                </div>
              </div>

              {/* Second Item (a divider will appear before this) */}
              <div className="flex items-start gap-2">
                <Award className="w-11 h-11 text-yellow-400" />
                <div>
                  <span className="text-sm font-bold">
                    Security Status: Gold Verified (93%)
                  </span>
                  <p className="text-xs text-muted-foreground italic">
                    View certificate
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-4">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-background font-bold min-w-[150px]"
                onClick={() => setIsInstallDialogOpen(true)}>
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

          {/* 4. Right Column: Media Gallery */}
          <div className="lg:col-span-2 flex flex-col justify-end">
            <MediaGallery images={server.galleryImages} appName={server.name} />
          </div>
        </div>
      </header>

      <InstallDialog
        server={server}
        open={isInstallDialogOpen}
        onOpenChange={setIsInstallDialogOpen}
      />
    </>
  );
}
