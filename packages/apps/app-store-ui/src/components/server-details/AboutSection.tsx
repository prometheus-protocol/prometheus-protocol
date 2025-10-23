import { Badge } from '@/components/ui/badge';
import { AppStoreDetails } from '@prometheus-protocol/ic-js';
import { Info } from 'lucide-react';

interface AboutSectionProps {
  server: AppStoreDetails;
}

export function AboutSection({ server }: AboutSectionProps) {
  return (
    <section>
      {/* 1. Main Heading */}
      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-4">
        <Info className="w-6 h-6" />
        About this app
      </h2>

      {/* 2. Primary Description */}
      <p className="text-muted-foreground mb-8">{server.description}</p>

      {/* 3. Key Features */}
      <h3 className="text-lg font-semibold mb-4">Key Features</h3>
      <ul className="list-disc list-outside pl-5 space-y-2 text-muted-foreground mb-8">
        {server.keyFeatures.map((feature, index) => (
          <li key={index}>{feature}</li>
        ))}
      </ul>

      {/* 4. Why This App */}
      <h3 className="text-lg font-semibold mb-4">Why {server.name}?</h3>
      <p className="text-muted-foreground mb-8">{server.whyThisApp}</p>

      {/* 5. Tags */}
      <div className="flex flex-wrap gap-2 mb-8">
        {server.tags.map((tag, index) => (
          <Badge key={index} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>

      {/* 6. Published Date */}
      <div className="text-sm text-muted-foreground">
        Published on{' '}
        {new Date(Number(server.latestVersion.created / 1_000_000n)).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </div>
    </section>
  );
}
