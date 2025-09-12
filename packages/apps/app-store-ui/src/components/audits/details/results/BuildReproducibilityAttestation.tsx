import { Section } from '@/components/Section';
import { BuildReproducibilityAttestationData } from '@prometheus-protocol/ic-js';
import { AlertTriangle, CheckCircle2, Github } from 'lucide-react';

export const BuildReproducibilityAttestation = ({
  data,
}: {
  data: BuildReproducibilityAttestationData;
}) => {
  const isSuccess = data.status === 'success';
  return (
    <Section
      title="Build Reproducibility"
      icon={<Github className="text-primary" />}>
      <div
        className={`border-l-4 ${isSuccess ? 'border-green-500' : 'border-red-500'} bg-gray-900/50 p-6 rounded-r-lg`}>
        <div className="flex items-center gap-3 mb-4">
          {isSuccess ? (
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-red-500" />
          )}
          <p className="text-2xl font-bold text-white">
            Outcome:{' '}
            <span className={isSuccess ? 'text-green-400' : 'text-red-400'}>
              {data.status.toUpperCase()}
            </span>
          </p>
        </div>
        <div className="space-y-2 text-gray-300">
          <p>
            <strong>Git Commit:</strong>{' '}
            <span className="font-mono">{data.git_commit}</span>
          </p>
          <p>
            <strong>Repository:</strong>{' '}
            <a href={data.repo_url} className="text-primary hover:underline">
              {data.repo_url}
            </a>
          </p>
          {!isSuccess && (
            <p>
              <strong>Failure Reason:</strong> {data.failure_reason}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
};
