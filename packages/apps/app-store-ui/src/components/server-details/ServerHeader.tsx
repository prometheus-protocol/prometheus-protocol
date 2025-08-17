import { Link } from 'react-router-dom';
import { FeaturedServer } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Heart } from 'lucide-react';
import { MediaGallery } from './MediaGallery';
import { useEffect, useState } from 'react';
import { InstallDialog } from './InstallDialog';
import { getTierInfo } from '@/lib/get-tier-info';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ServerHeaderProps {
  server: FeaturedServer;
}

type DialogState = 'closed' | 'confirm' | 'install';

export function ServerHeader({ server }: ServerHeaderProps) {
  const [dialogState, setDialogState] = useState<DialogState>('closed');

  const tierInfo = getTierInfo(server);
  const isCertified = !!server.certificate; // A more robust check

  const handleInstallClick = () => {
    // 2. The install click now just sets the initial state
    if (isCertified) {
      setDialogState('install');
    } else {
      setDialogState('confirm');
    }
  };

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
          <div className="lg:col-span-3">
            <h1 className="text-4xl font-bold tracking-tight">{server.name}</h1>

            <div
              className="
              mt-10 flex flex-wrap items-center gap-y-4 
              gap-x-6
            ">
              {/* First Item (always visible) */}
              <div className="flex gap-2 items-start">
                <img
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
                  <p className="text-sm font-bold">
                    {tierInfo.name} ({tierInfo.overallScore}%)
                  </p>
                  <Link
                    to={isCertified ? `./certificate` : '#'}
                    className={cn(
                      'text-xs text-muted-foreground italic',
                      isCertified
                        ? 'hover:underline'
                        : 'cursor-not-allowed opacity-50',
                    )}>
                    {isCertified
                      ? 'View certificate'
                      : 'No certificate available'}
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-12 flex items-center gap-4">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold min-w-[150px]"
                onClick={handleInstallClick}>
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

      <InstallDialog
        server={server}
        open={dialogState === 'install'}
        onOpenChange={(open) => !open && setDialogState('closed')}
      />

      <AlertDialog
        open={dialogState === 'confirm'}
        onOpenChange={(open) => !open && setDialogState('closed')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Connect to an Uncertified Server?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This server, <span className="font-bold">{server.name}</span>, has
              not been audited by Prometheus Protocol. While many uncertified
              servers are safe, connecting to them carries inherent risks.
              <br />
              <br />
              We cannot verify its code quality, performance, or security.
              Proceed with caution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setDialogState('install')}>
              I Understand, Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
