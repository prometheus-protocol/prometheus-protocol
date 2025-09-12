import { Section } from '@/components/Section';
import { SecurityAttestationData } from '@prometheus-protocol/ic-js';
import { ShieldCheck } from 'lucide-react';

export const SecurityAttestation = ({
  data,
}: {
  data: SecurityAttestationData;
}) => {
  const getSeverityClasses = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500 border-red-400';
      case 'high':
        return 'bg-orange-500 border-orange-400';
      case 'medium':
        return 'bg-yellow-500 border-yellow-400';
      default:
        return 'bg-blue-500 border-blue-400';
    }
  };

  return (
    <Section
      title="Security Analysis"
      icon={<ShieldCheck className="text-primary" />}>
      <p className="text-gray-300 mb-6">{data.summary}</p>
      <div className="space-y-4">
        {data.issues_found?.map((issue, i) => (
          <div key={i} className="border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-2 py-1 text-xs font-bold text-white rounded-full border ${getSeverityClasses(issue.severity)}`}>
                {issue.severity.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-300">{issue.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};
