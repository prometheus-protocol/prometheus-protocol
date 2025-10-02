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
import { useWithdraw } from '@/hooks/usePayment';
import { Principal } from '@dfinity/principal';
import { Token } from '@prometheus-protocol/ic-js';
import { toast } from 'sonner';

interface WithdrawDialogProps {
  token: Token;
  canisterPrincipal: Principal;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentBalance: number;
}

export function WithdrawDialog({
  token,
  canisterPrincipal,
  isOpen,
  onOpenChange,
  currentBalance,
}: WithdrawDialogProps) {
  // Zod schema for form validation
  const formSchema = z.object({
    recipient: z
      .string()
      .regex(/^[a-z0-9-]{5,63}$/, 'Invalid Principal ID format.'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero.')
      .max(currentBalance, 'Amount cannot exceed canister balance.'),
  });

  const { mutateAsync: withdraw, isPending } = useWithdraw();

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { recipient: '', amount: 0 },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await withdraw({
        token: token,
        canisterPrincipal: canisterPrincipal,
        to: Principal.fromText(values.recipient),
        amount: values.amount,
      });

      // Close dialog and reset form on successful submission
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error is already handled by useMutation
      console.error('Withdraw failed:', error);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Withdraw {token.symbol}</DialogTitle>
          <DialogDescription>
            Withdraw {token.symbol} from the canister's treasury to another
            Principal. The canister currently holds{' '}
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
              name="recipient"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient Principal</FormLabel>
                  <FormControl>
                    <Input placeholder="aaaaa-..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                Withdraw from Canister
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
