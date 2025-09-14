import { Section } from '@/components/Section';
import { XCircle } from 'lucide-react';

interface DivergenceReportProps {
  reason: string;
}

export const DivergenceReport = ({ reason }: DivergenceReportProps) => {
  return (
    <Section
      title="Build Failed to Reproduce"
      icon={<XCircle className="text-red-500" />}>
      <div className="space-y-4 py-4">
        <h3 className="text-lg font-semibold text-white">Auditor's Findings</h3>
        <p className="text-gray-400">
          The auditor was unable to reproduce the build from the provided source
          code. The bounty has been paid for this verification work.
        </p>
        <div className="border border-gray-700 bg-gray-900/50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-300 mb-2">Failure Reason:</h4>
          <p className="text-gray-400 whitespace-pre-wrap font-mono text-sm">
            {reason}
          </p>
        </div>
      </div>
    </Section>
  );
};
