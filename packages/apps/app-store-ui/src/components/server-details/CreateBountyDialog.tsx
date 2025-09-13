import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useCreateBounty, useSponsorBounty } from '@/hooks/useAuditBounties';
import { useMemo } from 'react';
import { Token } from '@prometheus-protocol/ic-js';
import { useTokenBalance } from '@/hooks/usePayment';

interface CreateBountyDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  appId: string; // The WASM ID
  auditType: string;
  // For the MVP, we'll assume USDC. A future version could pass a list of accepted tokens.
  paymentToken: Token;
}

// Helper component for displaying cost rows
const CostRow = ({
  label,
  value,
  symbol,
}: {
  label: string;
  value: string;
  symbol: string;
}) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono text-foreground">
      {value} {symbol}
    </span>
  </div>
);

export function CreateBountyDialog({
  isOpen,
  onOpenChange,
  appId,
  auditType,
  paymentToken,
}: CreateBountyDialogProps) {
  const { mutate: sponsorBounty, isPending, status } = useSponsorBounty();
  const { data: balance, isLoading: isBalanceLoading } =
    useTokenBalance(paymentToken); // 4. Enhance calculations to include the max spendable amount
  // 1. Calculate fixed fees and the maximum spendable amount first.
  //    This does NOT depend on the form's input.
  const { totalFees, maxSpendable } = useMemo(() => {
    const fees = paymentToken.fee * 2; // Escrow fee (in) + Payout fee (out)
    const maxSpendableAtomic = balance ? balance - BigInt(fees) : 0n;
    return {
      totalFees: fees,
      maxSpendable: Number(
        paymentToken.fromAtomic(
          maxSpendableAtomic > 0n ? maxSpendableAtomic : 0n,
        ),
      ),
    };
  }, [paymentToken, balance]);

  // 2. Create the form schema using the calculated maxSpendable value.
  const formSchema = useMemo(
    () =>
      z.object({
        amount: z.coerce
          .number()
          .positive('Bounty amount must be greater than zero.')
          .max(
            maxSpendable,
            'Amount exceeds your available balance after fees.',
          ),
      }),
    [maxSpendable],
  );

  // 3. Now, initialize the form. There is no more circular dependency.
  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 10 },
  });

  // 4. Watch the form's input value to calculate the *display* total cost.
  const bountyAmountInput = form.watch('amount') as number;
  const totalCost = useMemo(() => {
    const bountyAtomic = paymentToken.toAtomic(bountyAmountInput || 0);
    return bountyAtomic + BigInt(totalFees);
  }, [bountyAmountInput, totalFees, paymentToken]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    sponsorBounty(
      {
        appId,
        auditType,
        paymentToken,
        amount: values.amount,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          form.reset();
        },
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sponsor Bounty</DialogTitle>
          <DialogDescription className="text-sm text-primary">
            {auditType}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Fund a bounty to incentivize auditors to complete this attestation.
          The amount will be transferred from your account to the registry
          canister.
        </p>
        <Form {...form}>
          <form
            // @ts-ignore
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bounty Amount ({paymentToken.symbol})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      value={
                        field.value === undefined || field.value === null
                          ? ''
                          : Number(field.value)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {isBalanceLoading ? (
                      <div className="h-4 w-32 bg-muted/50 rounded-sm animate-pulse" />
                    ) : (
                      `Your balance: ${balance !== undefined ? paymentToken.fromAtomic(balance) : '0.00'} ${paymentToken.symbol}`
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 4. Display the dynamic cost breakdown */}
            <div className="border border-border rounded-md p-3 space-y-2">
              <CostRow
                label="Network Fees (In + Out)"
                value={paymentToken.fromAtomic(BigInt(totalFees))}
                symbol={paymentToken.symbol}
              />
              <hr className="border-border" />
              <CostRow
                label="Total Cost"
                value={paymentToken.fromAtomic(totalCost)}
                symbol={paymentToken.symbol}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={isPending}
                className="w-full !mt-6">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? status : 'Sponsor Bounty'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
