import { useInternetIdentity } from 'ic-use-internet-identity';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePaymentToken } from '@/hooks/useVerifierDashboard';

interface DepositInstructionsProps {
  className?: string;
}

export function DepositInstructions({
  className = '',
}: DepositInstructionsProps) {
  const { identity } = useInternetIdentity();
  const { data: paymentToken } = usePaymentToken();

  if (!identity || !paymentToken) {
    return null;
  }

  const principalId = identity.getPrincipal().toText();
  const tokenCanisterId = paymentToken.canisterId.toText();

  return (
    <div className={`p-4 border rounded-lg bg-muted/50 space-y-3 ${className}`}>
      <div>
        <p className="text-sm font-medium mb-1">
          Send {paymentToken.symbol} to Your Principal
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          Transfer {paymentToken.symbol} to this address to fund your verifier
          account
        </p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-background px-2 py-1 rounded border font-mono break-all flex-1">
            {principalId}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(principalId);
              toast.success('Principal ID copied');
            }}
            title="Copy Principal ID">
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-1">
          {paymentToken.symbol} Token Canister ID
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          OneSec USDC token (
          <a
            href="https://onesec.to"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground">
            onesec.to
          </a>
          ) -{' '}
          <a
            href={`https://dashboard.internetcomputer.org/tokens/${tokenCanisterId}/transactions`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground">
            View on ICP Dashboard
          </a>
        </p>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-background px-2 py-1 rounded border font-mono break-all flex-1">
            {tokenCanisterId}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(tokenCanisterId);
              toast.success('Canister ID copied');
            }}
            title="Copy Canister ID">
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
