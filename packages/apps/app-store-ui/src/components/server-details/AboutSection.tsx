import { Badge } from '@/components/ui/badge';
import { FeaturedServer } from '@/lib/mock-data';
import { Info } from 'lucide-react';

interface AboutSectionProps {
  server: FeaturedServer;
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
      <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-8">
        {server.keyFeatures.map((feature, index) => (
          <li key={index}>{feature}</li>
        ))}
      </ul>

      {/* 4. Why This App */}
      <h3 className="text-lg font-semibold mb-4">Why {server.name}?</h3>
      <p className="text-muted-foreground mb-8">{server.whyThisApp}</p>

      {/* 5. Tags */}
      <div className="flex flex-wrap gap-2">
        {server.tags.map((tag, index) => (
          <Badge key={index} variant="outline">
            {tag}
          </Badge>
        ))}
      </div>
    </section>
  );
}
