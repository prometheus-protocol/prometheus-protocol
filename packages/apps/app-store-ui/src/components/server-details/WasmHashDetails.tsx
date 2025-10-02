import { Principal } from '@dfinity/principal';
import { useWasmHash, uint8ArrayToHex } from '@/hooks/useWasmHash';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  HelpCircle,
  Code2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WasmHashDetailsProps {
  canisterId: Principal | undefined;
  expectedWasmId: string;
  namespace: string;
  className?: string;
}

export function WasmHashDetails({
  canisterId,
  expectedWasmId,
  namespace,
  className,
}: WasmHashDetailsProps) {
  const {
    status,
    isMatching,
    actualWasmHash,
    expectedWasmId: expectedId,
  } = useWasmHash(canisterId, expectedWasmId);

  if (!canisterId) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            WASM Verification
          </CardTitle>
          <CardDescription>
            No canister ID available for verification
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusBadge = () => {
    switch (status) {
      case 'loading':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verifying
          </Badge>
        );
      case 'match':
        return (
          <Badge
            variant="default"
            className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified
          </Badge>
        );
      case 'mismatch':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Mismatch
          </Badge>
        );
      case 'not-found':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            Not Found
          </Badge>
        );
      case 'error':
        return (
          <Badge
            variant="destructive"
            className="bg-orange-500 hover:bg-orange-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return 'Checking if the deployed canister matches the verified WASM hash...';
      case 'match':
        return 'The deployed canister matches the verified WASM hash. This app is running the expected code.';
      case 'mismatch':
        return 'Warning: The deployed canister does not match the verified WASM hash. This may indicate the app has been updated or compromised.';
      case 'not-found':
        return 'Could not retrieve the WASM hash from the canister. This may be a temporary network issue.';
      case 'error':
        return 'An error occurred while verifying the WASM hash. Please try again later.';
      default:
        return 'Unknown verification status.';
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            WASM Verification
          </CardTitle>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Verification of deployed canister code against expected WASM hash
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{getStatusMessage()}</p>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="text-muted-foreground font-sans font-medium">
              Canister ID:
            </label>
            <div className="mt-1 p-2 bg-muted rounded break-all">
              {canisterId.toText()}
            </div>
          </div>

          <div>
            <label className="text-muted-foreground font-sans font-medium">
              Expected WASM Hash:
            </label>
            <div className="mt-1 p-2 bg-muted rounded break-all">
              {expectedId}
            </div>
          </div>

          {actualWasmHash && (
            <div>
              <label className="text-muted-foreground font-sans font-medium">
                Actual WASM Hash:
              </label>
              <div
                className={cn(
                  'mt-1 p-2 rounded break-all',
                  isMatching
                    ? 'bg-green-50 text-green-900 border border-green-200'
                    : 'bg-red-50 text-red-900 border border-red-200',
                )}>
                {uint8ArrayToHex(actualWasmHash)}
              </div>
            </div>
          )}

          {status === 'match' && (
            <div className="flex items-center gap-2 text-green-600 font-sans">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                Hashes match - verification successful
              </span>
            </div>
          )}

          {status === 'mismatch' && (
            <div className="flex items-center gap-2 text-red-600 font-sans">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Hashes do not match - verification failed
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
