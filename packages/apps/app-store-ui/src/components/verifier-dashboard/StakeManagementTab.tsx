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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  useVerifierProfile,
  useDepositStake,
  useWithdrawStake,
  usePaymentToken,
  useAvailableBalance,
  useStakedBalance,
  useStakeRequirement,
} from '@/hooks/useVerifierDashboard';
import { useGetTokenBalance } from '@/hooks/usePayment';
import {
  getAllAuditTypes,
  getAuditTypeLabel,
  getAuditTypeDescription,
  type AuditType,
  AUDIT_TYPES,
} from '@prometheus-protocol/ic-js';
import { DepositInstructions } from './DepositInstructions';
import type { Token } from '@prometheus-protocol/ic-js';

interface AuditTypeEligibilityRowProps {
  auditType: AuditType;
  paymentToken: Token;
}

function AuditTypeEligibilityRow({
  auditType,
  paymentToken,
}: AuditTypeEligibilityRowProps) {
  const { data: stakeRequirement, isLoading } = useStakeRequirement(auditType);

  const stakeFormatted = stakeRequirement
    ? paymentToken.fromAtomic(stakeRequirement)
    : '—';

  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <div>
        <div className="font-medium">{getAuditTypeLabel(auditType)}</div>
        <div className="text-xs text-muted-foreground">
          {getAuditTypeDescription(auditType)}
        </div>
      </div>
      <div className="text-right">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin inline" />
        ) : (
          <>
            <div className="text-sm font-medium">
              {stakeFormatted} {paymentToken.symbol}
            </div>
            <div className="text-xs text-muted-foreground">
              Min. stake required
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function StakeManagementTab() {
  const { identity } = useInternetIdentity();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Fetch payment token and verifier profile
  const { data: paymentToken, isLoading: tokenLoading } = usePaymentToken();
  const { data: profile, isLoading: profileLoading } = useVerifierProfile();
  const { data: walletBalance, isLoading: balanceLoading } =
    useGetTokenBalance(paymentToken);

  // Fetch available and staked balances
  const { data: availableBalance, isLoading: availableBalanceLoading } =
    useAvailableBalance();
  const { data: stakedBalance, isLoading: stakedBalanceLoading } =
    useStakedBalance(paymentToken?.canisterId.toText());

  const isLoading =
    tokenLoading ||
    profileLoading ||
    balanceLoading ||
    availableBalanceLoading ||
    stakedBalanceLoading;

  // Mutations
  const depositMutation = useDepositStake();
  const withdrawMutation = useWithdrawStake();

  const auditTypes = getAllAuditTypes();

  const handleDeposit = () => {
    if (!paymentToken) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    const amountInSmallestUnits = paymentToken.toAtomic(amount);
    depositMutation.mutate(
      {
        amount: amountInSmallestUnits,
        auditType: AUDIT_TYPES.BUILD_REPRODUCIBILITY_V1,
      },
      {
        onSuccess: () => {
          setDepositAmount('');
        },
      },
    );
  };

  const handleWithdraw = () => {
    if (!paymentToken) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    const amountInSmallestUnits = paymentToken.toAtomic(amount);
    withdrawMutation.mutate(
      { amount: amountInSmallestUnits },
      {
        onSuccess: () => {
          setWithdrawAmount('');
        },
      },
    );
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

  // Calculate balances
  const availableBalanceFormatted = availableBalance
    ? paymentToken.fromAtomic(availableBalance)
    : '0';
  const stakedBalanceFormatted = stakedBalance
    ? paymentToken.fromAtomic(stakedBalance)
    : '0';
  const accountTotal = (
    parseFloat(availableBalanceFormatted) + parseFloat(stakedBalanceFormatted)
  ).toFixed(Math.min(paymentToken.decimals, 2));
  const totalBalance = walletBalance
    ? paymentToken.fromAtomic(walletBalance)
    : '0';

  // Calculate maximum withdrawable amount (available balance minus fee)
  const fee = paymentToken.fromAtomic(BigInt(paymentToken.fee));
  const maxWithdrawable = Math.max(
    0,
    parseFloat(availableBalanceFormatted) - parseFloat(fee),
  ).toFixed(Math.min(paymentToken.decimals, 2));

  return (
    <div className="space-y-6">
      {/* Deposit Instructions */}
      <DepositInstructions />

      {/* Balance Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBalance}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Your wallet balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {availableBalanceFormatted}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {availableBalanceFormatted} / {accountTotal} in verifier account
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Staked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stakedBalanceFormatted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Locked in active bounties
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balances Per Audit Type */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Type Eligibility</CardTitle>
          <CardDescription>
            Your available {paymentToken.symbol} balance can be used for any
            audit type. Stake requirements vary by audit type - you must have
            enough available balance to reserve bounties for that type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditTypes.map((auditType) => {
            return (
              <AuditTypeEligibilityRow
                key={auditType}
                auditType={auditType}
                paymentToken={paymentToken}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Deposit Section */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit Stake</CardTitle>
          <CardDescription>
            Deposit {paymentToken.symbol} to your verifier account. Your balance
            can be used to reserve bounties for any audit type.
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
              step={1 / 10 ** Math.min(paymentToken.decimals, 2)}
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
              Available: {availableBalanceFormatted} {paymentToken.symbol} • Max
              withdrawable: {maxWithdrawable} {paymentToken.symbol} (after {fee}{' '}
              {paymentToken.symbol} fee)
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
