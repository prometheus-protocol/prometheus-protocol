import { ProcessedAuditRecord, AuditBounty } from '@prometheus-protocol/ic-js';
import { CheckCircle2, XCircle, Clock, CircleOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { getAuditTypeInfo } from '@/lib/get-audit-type-info';

type AuditStatus = 'success' | 'failure' | 'pending' | 'unavailable';

interface CoreAuditStatusCardProps {
  auditType: string;
  status: AuditStatus;
  record?: ProcessedAuditRecord;
  bounty?: AuditBounty;
  appId: string;
}

const StatusInfo = ({ status }: { status: AuditStatus }) => {
  switch (status) {
    case 'success':
      return (
        <>
          <CheckCircle2 className="h-5 w-5 text-green-500" />{' '}
          <span className="font-semibold text-green-400">Completed</span>
        </>
      );
    case 'failure':
      return (
        <>
          <XCircle className="h-5 w-5 text-red-500" />{' '}
          <span className="font-semibold text-red-400">Failed</span>
        </>
      );
    case 'pending':
      return (
        <>
          <Clock className="h-5 w-5 text-yellow-500" />{' '}
          <span className="font-semibold text-yellow-400">Bounty Open</span>
        </>
      );
    default:
      return (
        <>
          <CircleOff className="h-5 w-5 text-gray-500" />{' '}
          <span className="font-semibold text-gray-500">Not Audited</span>
        </>
      );
  }
};

export const CoreAuditStatusCard = ({
  auditType,
  status,
  bounty,
  appId,
}: CoreAuditStatusCardProps) => {
  const info = getAuditTypeInfo(auditType);

  return (
    <div className="bg-card/50 border border-gray-700 rounded-lg p-4 flex flex-col">
      <div className="flex items-center gap-3">
        <info.Icon className="h-6 w-6 text-primary" />
        <h3 className="text-lg font-semibold">{info.title}</h3>
      </div>
      <p className="text-sm text-muted-foreground mt-2 flex-grow">
        {info.description}
      </p>
      <div className="border-t border-gray-700 my-4" />
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm">
          <StatusInfo status={status} />
        </div>
        {status === 'pending' && bounty && (
          <Button asChild variant="secondary" size="sm">
            <Link to={`/audit-hub/${bounty.id}`}>Claim Bounty</Link>
          </Button>
        )}
        {status === 'unavailable' && (
          <Button variant="secondary" size="sm" disabled>
            Sponsor
          </Button> // Placeholder for future
        )}
      </div>
    </div>
  );
};
