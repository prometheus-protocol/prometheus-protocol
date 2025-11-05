import { useState } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  useVerifierProfile,
  useDepositStake,
  useWithdrawStake,
  usePaymentToken,
} from '@/hooks/useVerifierDashboard';

export function StakeManagementTab() {
  const { identity } = useInternetIdentity();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Fetch payment token (includes conversion utilities) and verifier profile
  const { data: paymentToken, isLoading: tokenLoading } = usePaymentToken();
  const { data: profile, isLoading: profileLoading } = useVerifierProfile();

  const isLoading = tokenLoading || profileLoading;

  // Mutations
  const depositMutation = useDepositStake();
  const withdrawMutation = useWithdrawStake();

  const handleDeposit = () => {
    if (!paymentToken) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    // Use the token's toAtomic method for conversion
    const amountInSmallestUnits = paymentToken.toAtomic(amount);
    depositMutation.mutate({ amount: amountInSmallestUnits });
  };

  const handleWithdraw = () => {
    if (!paymentToken) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    // Use the token's toAtomic method for conversion
    const amountInSmallestUnits = paymentToken.toAtomic(amount);
    withdrawMutation.mutate({ amount: amountInSmallestUnits });
  };

  if (!identity) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-center text-muted-foreground">
            Please connect your wallet to manage your stake.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!paymentToken) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-center text-muted-foreground">
            Payment token configuration not available.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Use token's fromAtomic method for balance conversion
  const availableBalance = profile
    ? paymentToken.fromAtomic(profile.available_balance_usdc)
    : '0';
  const stakedBalance = profile
    ? paymentToken.fromAtomic(profile.staked_balance_usdc)
    : '0';
  const totalBalance = (
    parseFloat(availableBalance) + parseFloat(stakedBalance)
  ).toString();

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBalance}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentToken.symbol}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableBalance}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready to withdraw
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Staked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stakedBalance}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Locked in bounties
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deposit Section */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit Stake</CardTitle>
          <CardDescription>
            Deposit {paymentToken.symbol} to your verifier account. You must
            first approve the Audit Hub canister to spend {paymentToken.symbol}{' '}
            on your behalf via the {paymentToken.symbol} ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deposit-amount">
              Amount ({paymentToken.symbol})
            </Label>
            <Input
              id="deposit-amount"
              type="number"
              step={1 / 10 ** Math.min(paymentToken.decimals, 2)} // Step based on decimals, max 2
              placeholder="0.00"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              disabled={depositMutation.isPending}
            />
          </div>
          <Button
            onClick={handleDeposit}
            disabled={depositMutation.isPending || !depositAmount}
            className="w-full">
            {depositMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Deposit
          </Button>
        </CardContent>
      </Card>

      {/* Withdraw Section */}
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Stake</CardTitle>
          <CardDescription>
            Withdraw available {paymentToken.symbol} back to your wallet. Only
            unstaked balance can be withdrawn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount">
              Amount ({paymentToken.symbol})
            </Label>
            <Input
              id="withdraw-amount"
              type="number"
              step={1 / 10 ** Math.min(paymentToken.decimals, 2)}
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              disabled={withdrawMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Available to withdraw: {availableBalance} {paymentToken.symbol}
            </p>
          </div>
          <Button
            onClick={handleWithdraw}
            disabled={withdrawMutation.isPending || !withdrawAmount}
            className="w-full">
            {withdrawMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <ArrowUpFromLine className="mr-2 h-4 w-4" />
            Withdraw
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
