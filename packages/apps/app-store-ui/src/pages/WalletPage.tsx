import { useInternetIdentity } from 'ic-use-internet-identity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TokenManager } from '@/components/TokenManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Wallet, Info, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TransferDialog } from '@/components/TransferDialog';
import { Token, Tokens } from '@prometheus-protocol/ic-js';
import { useGetTokenBalance } from '@/hooks/usePayment';
import { useState } from 'react';

export default function WalletPage() {
  const { identity } = useInternetIdentity();
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedTransferToken, setSelectedTransferToken] =
    useState<Token | null>(null);

  // Get balance for the display token (selected or default to USDC)
  const displayToken = selectedTransferToken || Tokens.USDC;
  const { data: tokenBalance } = useGetTokenBalance(displayToken);
  const tokenBalanceNum = Number(displayToken.fromAtomic(tokenBalance ?? 0n));

  // Get balance specifically for the selected transfer token (for the dialog)
  const { data: transferTokenBalance } = useGetTokenBalance(
    selectedTransferToken || Tokens.USDC,
  );
  const transferTokenBalanceNum = selectedTransferToken
    ? Number(selectedTransferToken.fromAtomic(transferTokenBalance ?? 0n))
    : tokenBalanceNum;

  const handleTransferToken = (token: Token) => {
    setSelectedTransferToken(token);
    setIsTransferDialogOpen(true);
  };

  if (!identity) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Wallet</h1>
          <p className="text-muted-foreground mb-4">
            Please log in to view your wallet.
          </p>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 md:py-12 space-y-8 md:space-y-12">
      {/* Header */}
      <div className="flex flex-col items-start  gap-8">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 md:h-8 md:w-8" />
            My Wallet
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your token balances and transactions
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 md:pb-3">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Send className="h-5 w-5" />
              Quick Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Send tokens to another wallet
            </p>
            <Button
              onClick={() =>
                handleTransferToken(selectedTransferToken || Tokens.USDC)
              }
              className="w-full">
              Transfer {selectedTransferToken?.symbol || 'USDC'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {displayToken.symbol} Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {tokenBalanceNum.toFixed(2)} {displayToken.symbol}
            </p>
            <p className="text-sm text-muted-foreground">Available to spend</p>
          </CardContent>
        </Card>
      </div>

      {/* Information Panel */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium">Your Personal Wallet</p>
          <p className="mt-1 text-blue-700 dark:text-blue-300">
            These are token balances held directly by your Internet Identity
            account. You have full control over these funds and can transfer
            them freely.
          </p>
        </div>
      </div>

      {/* Token Management */}
      <Card className="p-0 border-none mt-12">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Your Tokens
          </CardTitle>
          <p className="text-xs md:text-sm text-muted-foreground">
            View and manage all your token balances
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-4">
          <TokenManager
            mode="balance"
            targetPrincipal={identity.getPrincipal()}
            showPrincipalId={true}
            principalIdLabel="Your Wallet Principal ID"
            principalIdDescription="This is your wallet address for receiving tokens"
            onTransfer={handleTransferToken}
          />
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      {selectedTransferToken && (
        <TransferDialog
          token={selectedTransferToken}
          isOpen={isTransferDialogOpen}
          onOpenChange={(open) => {
            setIsTransferDialogOpen(open);
            if (!open) setSelectedTransferToken(null);
          }}
          currentBalance={transferTokenBalanceNum}
        />
      )}
    </div>
  );
}
