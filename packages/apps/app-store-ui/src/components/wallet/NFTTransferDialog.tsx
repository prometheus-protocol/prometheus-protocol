import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { useTransferNFT, NFTMetadata } from '@/hooks/useNFT';
import { Principal } from '@dfinity/principal';

interface NFTTransferDialogProps {
  nft: NFTMetadata | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NFTTransferDialog({
  nft,
  isOpen,
  onOpenChange,
}: NFTTransferDialogProps) {
  const [recipientPrincipal, setRecipientPrincipal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useTransferNFT();

  const handleTransfer = async () => {
    if (!nft) return;

    setError(null);

    // Validate principal
    try {
      Principal.fromText(recipientPrincipal);
    } catch (e) {
      setError('Invalid principal ID');
      return;
    }

    try {
      await mutateAsync({
        tokenId: nft.tokenId,
        recipientPrincipal,
      });

      // Reset and close on success (mutation handles success message via toast)
      setRecipientPrincipal('');
      onOpenChange(false);
    } catch (error: any) {
      // Error is handled by useMutation with toast
      setError(error.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer NFT</DialogTitle>
          <DialogDescription>
            Transfer {nft?.name || `NFT #${nft?.tokenIndex}`} to another
            principal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {nft?.thumbnail && (
            <div className="flex justify-center">
              <img
                src={nft.thumbnail}
                alt={nft.name || `NFT #${nft.tokenIndex}`}
                className="w-32 h-32 object-cover rounded-lg"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Principal ID</Label>
            <Input
              id="recipient"
              placeholder="Enter principal ID..."
              value={recipientPrincipal}
              onChange={(e) => {
                setRecipientPrincipal(e.target.value);
                setError(null);
              }}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> This action cannot be undone. Make sure
              the recipient address is correct.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!recipientPrincipal || isPending}
            className="flex-1">
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Transfer
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
