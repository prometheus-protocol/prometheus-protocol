// src/components/server-details/DataSafetySection.tsx

import { Lock } from 'lucide-react';
import { DataSafetyInfo } from '@prometheus-protocol/ic-js';

// 1. Simplify the props. The component now only needs the data it will display.
interface DataSafetySectionProps {
  safetyInfo: DataSafetyInfo;
}

export function DataSafetySection({ safetyInfo }: DataSafetySectionProps) {
  // 2. Remove all conditional logic, state, and the renderContent function.
  // The component now has a single responsibility: display the safety info.
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-6">
        <Lock className="w-6 h-6" />
        Data Safety
      </h2>

      {/* 3. This is the content that was previously inside the `if (hasData)` block. */}
      <p className="text-muted-foreground mb-6">
        {safetyInfo.overallDescription}
      </p>
      <div className="border border-border rounded-lg p-6 space-y-4">
        <ul className="list-disc list-outside pl-5 space-y-2">
          {safetyInfo.dataPoints.map((point, index) => (
            <li key={index}>
              <span className="font-semibold">{point.title}:</span>{' '}
              <span className="text-muted-foreground">{point.description}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-4 mt-6">
          <p className="text-xs text-muted-foreground italic">
            The data safety practices listed above have been attested to by an
            independent auditor based on the developer's claims.
          </p>
        </div>
      </div>
    </section>
  );
}
