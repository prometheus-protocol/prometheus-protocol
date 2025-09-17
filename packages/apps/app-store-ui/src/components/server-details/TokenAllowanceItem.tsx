// src/components/connections/TokenAllowanceItem.tsx

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  useGetTokenAllowance,
  useGetTokenBalance,
  useUpdateAllowance,
} from '@/hooks/usePayment';
import { useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { Token } from '@prometheus-protocol/ic-js';
import TokenIcon from '../Token';

const formSchema = z.object({
  budget: z.coerce
    .number()
    .min(0, { message: 'Allowance cannot be negative.' }),
});

interface TokenAllowanceItemProps {
  token: Token;
  spenderPrincipal: Principal;
  onSuccess: () => void;
}

export function TokenAllowanceItem({
  token,
  spenderPrincipal,
  onSuccess,
}: TokenAllowanceItemProps) {
  const { identity } = useInternetIdentity();

  const { data: balance, isLoading: isBalanceLoading } =
    useGetTokenBalance(token);
  const { data: currentAllowance, isLoading: isAllowanceLoading } =
    useGetTokenAllowance(spenderPrincipal, token);

  const { mutate: updateAllowance, isPending } = useUpdateAllowance();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: { budget: 0 },
  });

  useEffect(() => {
    if (currentAllowance !== undefined) {
      form.reset({
        budget: Number(token.fromAtomic(currentAllowance)),
      });
    }
  }, [currentAllowance, token, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!identity) return;

    if (
      currentAllowance !== undefined &&
      Number(token.fromAtomic(currentAllowance)) === values.budget
    ) {
      onSuccess();
      return;
    }

    updateAllowance(
      {
        token,
        spender: spenderPrincipal,
        amount: values.budget,
      },
      { onSuccess },
    );
  }

  const isLoading = isBalanceLoading || isAllowanceLoading;

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center mb-4 space-x-3">
        <TokenIcon className="h-5" />
        <h3 className="font-medium">
          {token.name} ({token.symbol})
        </h3>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center h-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-2 text-sm text-muted-foreground space-y-1">
          <p>
            Your Balance:{' '}
            <span className="font-medium text-foreground">
              {balance !== undefined
                ? `${token.fromAtomic(balance)} ${token.symbol}`
                : '...'}
            </span>
          </p>
          <p>
            Current Allowance:{' '}
            <span className="font-medium text-foreground">
              {currentAllowance !== undefined
                ? `${token.fromAtomic(currentAllowance)} ${token.symbol}`
                : '...'}
            </span>
          </p>
        </div>
      )}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-4 flex items-start gap-4">
          <FormField
            control={form.control}
            name="budget"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={`Set new ${token.symbol} allowance...`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isPending || isLoading}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update
          </Button>
        </form>
      </Form>
    </div>
  );
}
