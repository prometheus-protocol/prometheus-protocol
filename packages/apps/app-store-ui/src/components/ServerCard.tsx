import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Server } from '@/lib/mock-data';

interface ServerCardProps {
  server: Server;
}

const tierStyles = {
  gold: 'text-yellow-400',
  silver: 'text-gray-400',
  bronze: 'text-orange-400',
};

export function ServerCard({ server }: ServerCardProps) {
  return (
    <Link
      to={`/server/${server.id}`}
      className="flex items-center gap-4 p-2 rounded-3xl hover:bg-accent transition-colors group">
      <img
        src={server.iconUrl}
        alt={`${server.name} icon`}
        className="w-16 h-16 rounded-xl object-cover"
      />
      <div className="flex-1">
        <h3 className="font-semibold group-hover:underline">{server.name}</h3>
        <p className="text-sm text-muted-foreground">{server.category}</p>
        <div className="flex items-center mt-1">
          <Award className={cn('w-4 h-4', tierStyles[server.tier])} />
        </div>
      </div>
    </Link>
  );
}
