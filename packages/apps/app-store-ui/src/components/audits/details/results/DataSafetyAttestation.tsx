import { Section } from '@/components/Section';
import { DataSafetyAttestationData } from '@prometheus-protocol/ic-js';
import { BookLock, CheckCircle } from 'lucide-react';
import { useMemo } from 'react';

// Define the structure for a single data point for clarity
type DataPoint = DataSafetyAttestationData['data_points'][0];

export const DataSafetyAttestation = ({
  data,
}: {
  data: DataSafetyAttestationData;
}) => {
  // 1. Group the data points by category for a more organized display.
  // useMemo ensures this calculation only runs when the data changes.
  const groupedPoints = useMemo(() => {
    if (!data.data_points) return {};

    return data.data_points.reduce(
      (acc: Record<string, DataPoint[]>, point) => {
        const category = point.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(point);
        return acc;
      },
      {},
    );
  }, [data.data_points]);

  return (
    <Section title="Data Safety" icon={<BookLock className="text-primary" />}>
      <div className="space-y-6">
        {/* 2. Display the high-level summary first. */}
        <p className="text-gray-400">{data.overall_description}</p>

        {/* 3. Iterate over the grouped categories to render each section. */}
        {Object.entries(groupedPoints).map(([category, points]) => (
          <div key={category}>
            <h3 className="text-lg font-semibold text-gray-300 mb-3">
              {category}
            </h3>
            <div className="space-y-4 pl-4 border-l border-gray-700">
              {/* 4. Iterate over the points within each category. */}
              {points.map((point, index) => (
                <div key={index}>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <h4 className="font-semibold text-white">{point.title}</h4>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 ml-6">
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};
