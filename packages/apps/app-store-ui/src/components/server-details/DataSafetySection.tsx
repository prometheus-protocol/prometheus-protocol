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
  // The condition for having meaningful data is that the points array exists and is not empty.
  const hasData =
    safetyInfo && safetyInfo.points && safetyInfo.points.length > 0;

  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight mb-6">Data safety</h2>

      {hasData ? (
        // If data exists, render the full details view.
        <>
          <p className="text-muted-foreground mb-6">{safetyInfo.description}</p>
          <div className="border border-border rounded-lg p-6 space-y-4">
            <ul className="list-disc list-inside space-y-3">
              {safetyInfo.points.map((point, index) => (
                <li key={index}>
                  <span className="font-semibold">{point.title}:</span>{' '}
                  <span className="text-muted-foreground">
                    {point.description}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground pt-2">
              Prometheus Protocol is designed with privacy by default—giving you
              full control, visibility, and peace of mind.
            </p>
          </div>
        </>
      ) : (
        // If no data, render the consistent empty state.
        <div className="border border-border rounded-lg min-h-[200px] flex flex-col items-center justify-center text-center p-6">
          <Lock className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold">
            Data Safety Information Not Provided
          </h3>
          <p className="text-sm text-muted-foreground">
            The developer has not yet provided data safety information for this
            app.
          </p>
        </div>
      )}
    </section>
  );
}
