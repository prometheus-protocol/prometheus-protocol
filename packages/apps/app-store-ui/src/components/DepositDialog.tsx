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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useTransfer } from '@/hooks/usePayment';
import { Principal } from '@icp-sdk/core/principal';
import { Token } from '@prometheus-protocol/ic-js';
import { toast } from 'sonner';

interface DepositDialogProps {
  token: Token;
  canisterPrincipal: Principal;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentBalance: number;
}

export function DepositDialog({
  token,
  canisterPrincipal,
  isOpen,
  onOpenChange,
  currentBalance,
}: DepositDialogProps) {
  // Zod schema for form validation
  const formSchema = z.object({
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero.')
      .max(currentBalance, 'Amount cannot exceed your balance.'),
  });

  const { mutate: transfer, isPending } = useTransfer();

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    transfer(
      {
        token,
        to: canisterPrincipal,
        amount: values.amount,
      },
      {
        onSuccess: () => {
          toast.success(
            `Successfully deposited ${values.amount} ${token.symbol} to app canister`,
          );
          form.reset();
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(`Deposit failed: ${error.message}`);
        },
      },
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Deposit {token.symbol}</DialogTitle>
          <DialogDescription>
            Deposit {token.symbol} from your wallet to the app canister. You
            currently hold{' '}
            <span className="font-semibold">
              {currentBalance.toFixed(4)} {token.symbol}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
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
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      value={Number(field.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Deposit to Canister
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
