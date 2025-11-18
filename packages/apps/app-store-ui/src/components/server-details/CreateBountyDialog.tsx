import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import {
  useSponsorBounty,
  useSponsoredAuditTypes,
} from '@/hooks/useAuditBounties';
import {
  ProcessedVerificationRecord,
  CORE_AUDIT_TYPES,
} from '@prometheus-protocol/ic-js';
import { getAuditTypeInfo } from '@/lib/get-audit-type-info';
import { useState } from 'react';

interface CreateBountyDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  wasmId: string; // The WASM ID
  verificationRequest: ProcessedVerificationRecord;
  completedAuditTypes?: string[]; // List of audit types already completed
  onSuccess?: () => void;
}

export function CreateBountyDialog({
  isOpen,
  onOpenChange,
  wasmId,
  verificationRequest,
  completedAuditTypes = [],
  onSuccess,
}: CreateBountyDialogProps) {
  const { mutate: sponsorBounty, isPending, status } = useSponsorBounty();
  const { data: sponsoredAuditTypes = [], isLoading: isLoadingSponsoredTypes } =
    useSponsoredAuditTypes(wasmId);
  const [selectedAuditType, setSelectedAuditType] = useState<string | null>(
    null,
  );

  const hasBuildReproducibility = completedAuditTypes.includes(
    'build_reproducibility_v1',
  );

  function handleSponsor(auditType: string) {
    setSelectedAuditType(auditType);
    sponsorBounty(
      {
        wasmId,
        auditTypes: [auditType],
        verificationRequest,
      },
      {
        onSuccess: () => {
          setSelectedAuditType(null);
          onOpenChange(false);
          onSuccess?.();
        },
        onError: () => {
          setSelectedAuditType(null);
        },
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sponsor Audit Bounties</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select an audit type to sponsor. The first round of bounties is
            sponsored by the protocol. Subsequent rounds require user payment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {isLoadingSponsoredTypes ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            CORE_AUDIT_TYPES.map((auditType) => {
              const info = getAuditTypeInfo(auditType);
              const isCompleted = completedAuditTypes.includes(auditType);
              const isAlreadySponsored =
                sponsoredAuditTypes.includes(auditType);
              const requiresBuildReproducibility =
                auditType !== 'build_reproducibility_v1' &&
                !hasBuildReproducibility;
              const isDisabled =
                isCompleted ||
                isPending ||
                requiresBuildReproducibility ||
                isAlreadySponsored;
              const isProcessing = isPending && selectedAuditType === auditType;

              return (
                <Button
                  key={auditType}
                  onClick={() => handleSponsor(auditType)}
                  disabled={isDisabled}
                  variant="outline"
                  className="w-full h-auto py-4 px-4 flex items-start gap-3 justify-start">
                  <info.Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="font-semibold flex items-center gap-2">
                      {info.title}
                      {isCompleted && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {!isAlreadySponsored && !isCompleted && (
                        <span className="inline-flex items-center gap-1 text-xs font-normal bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          <Sparkles className="h-3 w-3" />
                          Protocol Sponsored
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground mt-1">
                      {info.description}
                    </div>
                    {requiresBuildReproducibility && (
                      <div className="text-xs font-normal text-amber-500 mt-1">
                        ⚠️ Build Reproducibility must be completed first
                      </div>
                    )}
                  </div>
                  {isProcessing && (
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  )}
                </Button>
              );
            })
          )}
        </div>
        {isPending && (
          <div className="text-sm text-center text-muted-foreground pb-2">
            {status}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
