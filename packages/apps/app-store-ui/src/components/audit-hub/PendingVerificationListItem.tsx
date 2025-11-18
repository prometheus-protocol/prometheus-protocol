import { ProcessedVerificationRecord } from '@prometheus-protocol/ic-js';
import { Button } from '@/components/ui/button';
import { truncatePrincipal } from '@/lib/utils';
import { Github, FileCode } from 'lucide-react';
import { truncateHash } from '@prometheus-protocol/ic-js/utils';

interface PendingVerificationListItemProps {
  request: ProcessedVerificationRecord;
  onSponsorClick: (wasmId: string) => void;
  isSponsored?: boolean;
}

export const PendingVerificationListItem = ({
  request,
  onSponsorClick,
  isSponsored = false,
}: PendingVerificationListItemProps) => {
  // Extract app metadata
  const appName = request.metadata?.name;
  const publisher = request.metadata?.publisher;
  const description = request.metadata?.description;
  const category = request.metadata?.category;

  return (
    <div className="border border-gray-700 rounded-lg hover:border-primary transition-colors">
      {/* --- DESKTOP VIEW --- */}
      <div className="hidden md:grid grid-cols-12 gap-4 items-center px-4 py-4">
        <div className="col-span-3 flex items-center gap-3">
          <FileCode className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            {appName ? (
              <>
                <div className="font-semibold text-white truncate">
                  {appName}
                </div>
                <div className="text-xs text-gray-500 mt-1 font-mono truncate">
                  {truncateHash(request.wasm_hash)}
                </div>
                {category && (
                  <div className="text-xs text-primary mt-1">{category}</div>
                )}
              </>
            ) : (
              <>
                <div className="font-mono font-semibold text-white">
                  {truncateHash(request.wasm_hash)}
                </div>
                {request.requester && (
                  <div className="text-xs text-gray-500 mt-1">
                    By: {truncatePrincipal(request.requester.toText())}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="col-span-4 min-w-0">
          {description ? (
            <div className="text-sm text-gray-300 line-clamp-2">
              {description}
            </div>
          ) : (
            <a
              href={`${request.repo}/commit/${request.commit_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <Github className="h-4 w-4 flex-shrink-0" />
              <span className="font-mono truncate">
                {truncateHash(request.commit_hash, 24)}
              </span>
            </a>
          )}
        </div>
        <div className="col-span-2 text-gray-400 text-sm">
          {publisher ||
            (request.requester &&
              truncatePrincipal(request.requester.toText()))}
        </div>
        <div className="col-span-2 text-gray-400 text-sm">
          {request.timestamp.toLocaleDateString()}
        </div>
        <div className="col-span-1 text-right">
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600"
            onClick={() => onSponsorClick(request.wasm_hash)}
            disabled={isSponsored}>
            {isSponsored ? 'Sponsored' : 'Sponsor'}
          </Button>
        </div>
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <FileCode className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              {appName ? (
                <>
                  <div className="font-semibold text-white text-lg truncate">
                    {appName}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-mono truncate">
                    {truncateHash(request.wasm_hash)}
                  </div>
                  {category && (
                    <div className="text-xs text-primary mt-1">{category}</div>
                  )}
                </>
              ) : (
                <span className="font-semibold text-white text-lg font-mono">
                  {truncateHash(request.wasm_hash)}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-600 ml-2 flex-shrink-0"
            onClick={() => onSponsorClick(request.wasm_hash)}
            disabled={isSponsored}>
            {isSponsored ? 'Sponsored' : 'Sponsor'}
          </Button>
        </div>

        {description && (
          <div className="mb-3 text-sm text-gray-300 line-clamp-2">
            {description}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          {publisher && (
            <div>
              <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
                Publisher
              </div>
              <div className="text-gray-300">{publisher}</div>
            </div>
          )}
          <div className={publisher ? '' : 'col-span-2'}>
            <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
              Source
            </div>
            <a
              href={`${request.repo}/commit/${request.commit_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-300 hover:text-white">
              <Github className="h-4 w-4" />
              <span className="font-mono truncate">
                {truncateHash(request.commit_hash, 16)}
              </span>
            </a>
          </div>
          <div>
            <div className="text-gray-500 uppercase text-xs font-semibold mb-1">
              Submitted On
            </div>
            <div className="text-gray-300">
              {request.timestamp.toLocaleDateString()}
            </div>
          </div>
          {!publisher && request.requester && (
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
