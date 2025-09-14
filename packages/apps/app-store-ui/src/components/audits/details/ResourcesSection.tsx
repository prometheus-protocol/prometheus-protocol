import { AuditBountyWithDetails } from '@prometheus-protocol/ic-js';
import { ExternalLink, FileText, Github } from 'lucide-react';

export const ResourcesSection = ({
  audit,
}: {
  audit: AuditBountyWithDetails;
}) => (
  <div className="mt-8">
    <h2 className="text-xl font-semibold text-white mb-6">Resources</h2>
    <div className="flex flex-col gap-3">
      <a
        href={audit.repo}
        className="inline-flex items-center gap-2 text-primary hover:underline w-fit"
        target="_blank"
        rel="noopener noreferrer">
        <Github className="h-5 w-5" />
        <span>Source Code Repo</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <a
        href="https://docs.prometheusprotocol.org/guides/auditors/overview"
        className="inline-flex items-center gap-2 text-primary hover:underline w-fit"
        target="_blank"
        rel="noopener noreferrer">
        <FileText className="h-5 w-5" />
        <span>Audit Documentation</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  </div>
);
