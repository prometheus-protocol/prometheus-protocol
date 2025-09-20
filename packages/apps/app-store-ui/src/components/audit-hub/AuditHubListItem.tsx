import { Link } from 'react-router-dom';
import { AuditBounty, Tokens } from '@prometheus-protocol/ic-js';
import { uint8ArrayToHex } from '@prometheus-protocol/ic-js/utils';
import { Lock, ShieldCheck, Cog } from 'lucide-react';
import Token from '@/components/Token';

// Helper to format status color
const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'open':
      return 'text-green-400';
    case 'claimed':
      return 'text-primary';
    default:
      return 'text-gray-400';
  }
};

// Helper for project icons based on audit type
const getProjectIcon = (auditType: string) => {
  if (auditType.toLowerCase().includes('security'))
    return <Lock className="h-5 w-5 text-gray-400" />;
  if (auditType.toLowerCase().includes('compliance'))
    return <ShieldCheck className="h-5 w-5 text-gray-400" />;
  return <Cog className="h-5 w-5 text-gray-400" />;
};

export const AuditHubListItem = ({ audit }: { audit: AuditBounty }) => {
  const auditType = audit.challengeParameters.audit_type || 'unknown';
  const status = audit.claimedTimestamp ? 'Claimed' : 'Open';
  const wasmHash = uint8ArrayToHex(audit.challengeParameters.wasm_hash);
  const projectName = wasmHash.slice(0, 10) + '...' + wasmHash.slice(-4);

  return (
    <div className="bg-card/50 border border-gray-700 rounded-lg hover:border-primary transition-colors">
      <Link to={`/audit-hub/${audit.id}`}>
        {/* --- DESKTOP VIEW --- */}
        <div className="hidden md:grid grid-cols-12 gap-4 items-center px-4 py-4">
          <div className="col-span-2 flex items-center gap-3">
            {getProjectIcon(auditType)}
            <span className="font-semibold text-white">
              {audit.id.toString()}
            </span>
          </div>
          <div className="col-span-3 text-gray-400">{auditType}</div>
          <div className="col-span-3 font-mono">{projectName}</div>
          <div className="col-span-2 flex items-center justify-end gap-2 font-mono text-white">
            ${Tokens.USDC.fromAtomic(audit.tokenAmount)}{' '}
            <Token className="h-5" />
          </div>
          <div className="col-span-2 text-center">
            <span className={`font-semibold ${getStatusColor(status)}`}>
              {status}
            </span>
          </div>
        </div>
        {/* --- MOBILE VIEW --- */}
        {/* This view is visible by default and hidden on medium screens and up */}
        <div className="md:hidden p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              {getProjectIcon(auditType)}
              <span className="font-semibold text-white text-lg">
                {audit.id}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Audit Type
              </div>
              <div className="text-gray-300">{auditType}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Status
              </div>
              <div className={`font-semibold ${getStatusColor(status)}`}>
                {status}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Reward
              </div>
              <div className="flex items-center gap-2 font-mono text-white">
                ${Tokens.USDC.fromAtomic(audit.tokenAmount)}
                <Token className="h-5" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};
