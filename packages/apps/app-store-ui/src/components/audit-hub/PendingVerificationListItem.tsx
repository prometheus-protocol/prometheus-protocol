import { ProcessedVerificationRecord } from '@prometheus-protocol/ic-js';
import { Button } from '@/components/ui/button';
import { truncatePrincipal } from '@/lib/utils';
import { Github, FileCode } from 'lucide-react'; // Using a generic icon for pending items
import { truncateHash } from '@prometheus-protocol/ic-js/utils';

interface PendingVerificationListItemProps {
  request: ProcessedVerificationRecord;
  onSponsorClick: (wasmId: string) => void;
}

export const PendingVerificationListItem = ({
  request,
  onSponsorClick,
}: PendingVerificationListItemProps) => {
  return (
    <div className="border border-gray-700 rounded-lg hover:border-primary transition-colors">
      {/* --- DESKTOP VIEW (Inspired by AuditHubListItem) --- */}
      <div className="hidden md:grid grid-cols-12 gap-4 items-center px-4 py-4">
        <div className="col-span-2 flex items-center gap-3">
          <FileCode className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div>
            <div className="font-mono font-semibold text-white">
              {truncateHash(request.wasm_hash)}
            </div>
            {request.requester && (
              <div className="text-xs text-gray-500 mt-1">
                By: {truncatePrincipal(request.requester.toText())}
              </div>
            )}
          </div>
        </div>
        <div className="col-span-5">
          <a
            href={`${request.repo}/commit/${request.commit_hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <Github className="h-4 w-4 flex-shrink-0" />
            <span className="font-mono">
              {truncateHash(request.commit_hash, 24)}
            </span>
          </a>
        </div>
        <div className="col-span-3 text-gray-400">
          {request.timestamp.toLocaleString()}
        </div>
        <div className="col-span-2 text-right">
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600"
            onClick={() => onSponsorClick(request.wasm_hash)}>
            Sponsor
          </Button>
        </div>
      </div>

      {/* --- MOBILE VIEW (Inspired by AuditHubListItem) --- */}
      <div className="md:hidden p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <FileCode className="h-5 w-5 text-gray-400" />
            <span className="font-semibold text-white text-lg font-mono">
              {truncateHash(request.wasm_hash)}
            </span>
          </div>
          <Button variant="outline" size="sm" className="border-gray-600">
            Sponsor
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
              Source
            </div>
            <a
              href={`${request.repo}/commit/${request.commit_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-300 hover:text-white">
              <Github className="h-4 w-4" />
              <span className="font-mono">
                {truncateHash(request.commit_hash, 16)}
              </span>
            </a>
          </div>
          <div>
            <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
              Submitted On
            </div>
            <div className="text-gray-300">
              {request.timestamp.toLocaleString()}
            </div>
          </div>
          {request.requester && (
            <div className="text-right">
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Submitted By
              </div>
              <div className="text-gray-300 font-mono">
                {truncatePrincipal(request.requester.toText())}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
