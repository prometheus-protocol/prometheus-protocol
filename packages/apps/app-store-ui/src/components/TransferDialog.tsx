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
import { useTransfer } from '@/hooks/usePayment'; // This hook needs to be created
import { Principal } from '@dfinity/principal';
import { Token } from '@prometheus-protocol/ic-js';

interface TransferUsdcDialogProps {
  token: Token;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentBalance: number;
}

export function TransferDialog({
  token,
  isOpen,
  onOpenChange,
  currentBalance,
}: TransferUsdcDialogProps) {
  // Zod schema for form validation
  const formSchema = z.object({
    recipient: z
      .string()
      .regex(/^[a-z0-9-]{5,63}$/, 'Invalid Principal ID format.'),
    amount: z.coerce
      .number()
      .positive('Amount must be greater than zero.')
      .max(currentBalance, 'Amount cannot exceed your balance.'),
  });

  const { mutate: transfer, isPending } = useTransfer();

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { recipient: '', amount: 0 },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    transfer({
      token: token,
      to: Principal.fromText(values.recipient),
      amount: values.amount,
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transfer {token.symbol}</DialogTitle>
          <DialogDescription>
            Send {token.symbol} from your balance to another Principal. Your
            current balance is{' '}
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
                Send Transfer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
