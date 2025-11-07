import { Section } from '@/components/Section';
import { BuildReproducibilityAttestationData } from '@prometheus-protocol/ic-js';
import { Principal } from '@icp-sdk/core/principal';
import { AlertTriangle, CheckCircle2, Github, Clock, User } from 'lucide-react';

export const BuildReproducibilityAttestation = ({
  data,
  auditor,
}: {
  data: BuildReproducibilityAttestationData;
  auditor?: Principal;
}) => {
  // Check if this is the new format (v2) or legacy format (v1)
  const isV2 = auditor !== undefined;
  const isSuccess = isV2 ? true : data.status === 'success';

  // Convert timestamp from nanoseconds to milliseconds
  const buildDate = data.build_timestamp
    ? new Date(Number(data.build_timestamp) / 1_000_000)
    : null;
  const durationSeconds = data.build_duration_seconds
    ? Number(data.build_duration_seconds)
    : null;

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
              {isSuccess ? 'SUCCESS' : data.status?.toUpperCase()}
            </span>
          </p>
        </div>
        <div className="space-y-3 text-gray-300">
          {/* V2 specific fields */}
          {isV2 && (
            <>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <p>
                  <strong>Verifier:</strong>{' '}
                  <span className="font-mono text-sm">{auditor?.toText()}</span>
                </p>
              </div>
              {buildDate && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <p>
                    <strong>Build Time:</strong> {buildDate.toLocaleString()}
                  </p>
                </div>
              )}
              {durationSeconds !== null && (
                <p>
                  <strong>Duration:</strong> {durationSeconds} seconds
                </p>
              )}
              {data.verifier_version && (
                <p>
                  <strong>Verifier Version:</strong> {data.verifier_version}
                </p>
              )}
              {data.bounty_id !== undefined && (
                <p>
                  <strong>Bounty ID:</strong> {data.bounty_id.toString()}
                </p>
              )}
            </>
          )}

          {/* Common fields (both v1 and v2) */}
          {data.git_commit && (
            <p>
              <strong>Git Commit:</strong>{' '}
              <span className="font-mono text-sm">{data.git_commit}</span>
            </p>
          )}
          {data.repo_url && (
            <p>
              <strong>Repository:</strong>{' '}
              <a href={data.repo_url} className="text-primary hover:underline">
                {data.repo_url}
              </a>
            </p>
          )}

          {/* Build log (v2 only) */}
          {isV2 && data.build_log_excerpt && (
            <div className="mt-4">
              <p className="font-semibold mb-2">Build Log (excerpt):</p>
              <pre className="bg-black/50 p-3 rounded text-xs overflow-x-auto">
                {data.build_log_excerpt}
              </pre>
            </div>
          )}

          {/* V1 failure reason (legacy) */}
          {!isV2 && !isSuccess && data.failure_reason && (
            <div className="mt-4">
              <p className="font-semibold mb-2">Failure Reason:</p>
              <pre className="bg-black/50 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                {data.failure_reason}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
};
