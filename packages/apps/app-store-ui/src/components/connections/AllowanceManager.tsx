import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
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
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  useGetTokenAllowance,
  useGetTokenBalance,
  useUpdateAllowance,
} from '@/hooks/usePayment';
import { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Principal } from '@dfinity/principal';
import { Label } from '@/components/ui/label';
import { Auth } from '@prometheus-protocol/declarations';
import { Tokens } from '@prometheus-protocol/ic-js';

const formSchema = z.object({
  budget: z.coerce
    .number()
    .min(0, { message: 'Allowance cannot be negative.' }),
});

interface AllowanceManagerProps {
  resourceServer: Auth.PublicResourceServer;
  spenderPrincipal: Principal;
  onSuccess: () => void;
  submitButtonText: string;
  // isSetupFlow and sessionId can be kept if the setup flow is still needed
}

export function AllowanceManager({
  resourceServer,
  spenderPrincipal,
  onSuccess,
  submitButtonText,
}: AllowanceManagerProps) {
  const { identity } = useInternetIdentity();

  // 2. Get the list of available tokens by filtering our central registry
  const availableTokens = useMemo(() => {
    const acceptedCanisterIds = new Set(
      resourceServer.accepted_payment_canisters.map((p) => p.toText()),
    );
    return Object.values(Tokens).filter((token) =>
      acceptedCanisterIds.has(token.canisterId.toText()),
    );
  }, [resourceServer]);

  // 3. Manage state using the token's unique symbol
  const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<
    string | undefined
  >(availableTokens[0]?.symbol);
  const selectedToken = useMemo(
    () => availableTokens.find((t) => t.symbol === selectedTokenSymbol),
    [availableTokens, selectedTokenSymbol],
  );

  // 4. Use the new, refactored hooks that accept a Token object
  const { data: balance, isLoading: isBalanceLoading } =
    useGetTokenBalance(selectedToken);
  const { data: currentAllowance, isLoading: isAllowanceLoading } =
    useGetTokenAllowance(spenderPrincipal, selectedToken);

  const { mutate: updateAllowance, isPending } = useUpdateAllowance();

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { budget: 0 },
  });

  // 5. Update the form value using the token's fromAtomic method
  useEffect(() => {
    if (currentAllowance !== undefined && selectedToken) {
      form.reset({
        budget: Number(selectedToken.fromAtomic(currentAllowance)),
      });
    }
  }, [currentAllowance, selectedToken, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!identity || !spenderPrincipal || !selectedToken) return;

    // If the new allowance is the same as the current one, do nothing
    if (
      currentAllowance !== undefined &&
      Number(selectedToken.fromAtomic(currentAllowance)) === values.budget
    ) {
      onSuccess();
      return;
    }

    // The management flow is now much cleaner
    updateAllowance(
      {
        token: selectedToken,
        spender: spenderPrincipal,
        amount: values.budget,
      },
      { onSuccess },
    );
  }

  const isLoading = isBalanceLoading || isAllowanceLoading;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Label>Payment Token</Label>
        <Select
          onValueChange={setSelectedTokenSymbol}
          value={selectedTokenSymbol}>
          <SelectTrigger>
            <SelectValue placeholder="Select a payment token..." />
          </SelectTrigger>
          <SelectContent>
            {availableTokens.map((token) => (
              <SelectItem key={token.symbol} value={token.symbol}>
                {token.name} ({token.symbol})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Form {...form}>
          {/* @ts-ignore */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Allowance ({selectedToken?.symbol})</FormLabel>
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
                    {/* 6. Display the balance using the token's fromAtomic method */}
                    Your balance:{' '}
                    {balance !== undefined && selectedToken
                      ? `${selectedToken.fromAtomic(balance)} ${selectedToken.symbol}`
                      : '...'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full !mt-8"
              disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Approving...' : submitButtonText}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
