import { Lock } from 'lucide-react';

// Define a type for safetyInfo if it's not in mock-data
interface SafetyInfo {
  description: string;
  points: { title: string; description: string }[];
}

interface DataSafetySectionProps {
  safetyInfo: SafetyInfo;
}

export function DataSafetySection({ safetyInfo }: DataSafetySectionProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Data safety</h2>
      <p className="text-muted-foreground mb-6">{safetyInfo.description}</p>
      <div className="border border-border rounded-lg p-6 space-y-4">
        <ul className="list-disc list-inside space-y-3">
          {safetyInfo.points.map((point, index) => (
            <li key={index}>
              <span className="font-semibold">{point.title}:</span>{' '}
              <span className="text-muted-foreground">{point.description}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground pt-2">
          MetaManifest is designed with privacy by default—giving you full
          control, visibility, and peace of mind.
        </p>
      </div>
    </section>
  );
}
