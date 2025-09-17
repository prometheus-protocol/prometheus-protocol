// src/components/server-details/ArchivedVersionBanner.tsx

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Archive } from 'lucide-react';

interface ArchivedVersionBannerProps {
  namespace: string;
}

export function ArchivedVersionBanner({
  namespace,
}: ArchivedVersionBannerProps) {
  return (
    <div className="mb-8 p-4 bg-muted border border-border rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Archive className="w-6 h-6 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">
            You are viewing an archived version.
          </h3>
          <p className="text-sm text-muted-foreground">
            Actions like sponsoring bounties are disabled.
          </p>
        </div>
      </div>
      <Button asChild>
        <Link to={`/app/${namespace}`}>View Latest Version</Link>
      </Button>
    </div>
  );
}
