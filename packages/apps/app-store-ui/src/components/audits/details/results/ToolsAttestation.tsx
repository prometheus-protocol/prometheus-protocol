import { Section } from '@/components/Section';
import {
  ToolsAttestationData,
  AuditBountyWithDetails,
} from '@prometheus-protocol/ic-js';
import { Wrench, Github, Clock, User } from 'lucide-react';
import { Principal } from '@icp-sdk/core/principal';

export const ToolsAttestation = ({
  data,
  audit,
}: {
  data: ToolsAttestationData;
  audit?: AuditBountyWithDetails;
}) => {
  // Extract build info from audit metadata if available (only for success results)
  const buildTimestamp =
    audit?.results?.type === 'success'
      ? audit.results.data?.build_timestamp
      : undefined;
  const buildDuration =
    audit?.results?.type === 'success'
      ? audit.results.data?.build_duration_seconds
      : undefined;
  const gitCommit = audit?.commitHash;
  const repoUrl = audit?.repo;
  const auditor =
    audit?.results?.type === 'success' ? audit.results.auditor : undefined;
  const buildLogExcerpt =
    audit?.results?.type === 'success'
      ? audit.results.data?.build_log_excerpt
      : undefined;
  const verifierVersion =
    audit?.results?.type === 'success'
      ? audit.results.data?.verifier_version
      : undefined;
  const bountyId =
    audit?.results?.type === 'success'
      ? audit.results.data?.bounty_id
      : undefined;

  const buildDate = buildTimestamp
    ? new Date(Number(buildTimestamp) / 1_000_000)
    : null;
  const durationSeconds = buildDuration ? Number(buildDuration) : null;

  return (
    <>
      {/* Build Verification Details */}
      {(gitCommit || repoUrl || auditor) && (
        <Section
          title="Build Verification"
          icon={<Github className="text-primary" />}>
          <div className="border-l-4 border-green-500 bg-gray-900/50 p-6 rounded-r-lg">
            <div className="space-y-3 text-gray-300">
              {auditor && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <p>
                    <strong>Verifier:</strong>{' '}
                    <span className="font-mono text-sm">
                      {auditor.toText()}
                    </span>
                  </p>
                </div>
              )}
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
              {verifierVersion && (
                <p>
                  <strong>Verifier Version:</strong> {verifierVersion}
                </p>
              )}
              {bountyId !== undefined && (
                <p>
                  <strong>Bounty ID:</strong> {bountyId.toString()}
                </p>
              )}
              {gitCommit && (
                <p>
                  <strong>Git Commit:</strong>{' '}
                  <span className="font-mono text-sm">{gitCommit}</span>
                </p>
              )}
              {repoUrl && (
                <p>
                  <strong>Repository:</strong>{' '}
                  <a href={repoUrl} className="text-primary hover:underline">
                    {repoUrl}
                  </a>
                </p>
              )}
              {buildLogExcerpt && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Build Log (excerpt):</p>
                  <pre className="bg-black/50 p-3 rounded text-xs overflow-x-auto">
                    {buildLogExcerpt}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      <div className="mt-8">
        <Section
          title="Advertised Tools"
          icon={<Wrench className="text-primary" />}>
          <div className="space-y-4">
            {data.tools?.map((tool, i) => (
              <div key={i} className="border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-mono text-lg text-white">{tool.name}</h3>
                  <p className="font-semibold text-primary">
                    {tool.cost} {tool.token}
                  </p>
                </div>
                <p className="text-gray-400">{tool.description}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
};
