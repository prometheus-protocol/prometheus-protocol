import { ServerCard } from './ServerCard';
import { AppStoreListing } from '@prometheus-protocol/ic-js';

interface ServerGridProps {
  title: string;
  servers: AppStoreListing[];
}

export function ServerGrid({ title, servers }: ServerGridProps) {
  return (
    <section className="py-16">
      <h2 className="text-2xl font-bold tracking-tight mb-6 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">
        {servers.map((server) => (
          <ServerCard key={server.id} app={server} />
        ))}
      </div>
    </section>
  );
}
