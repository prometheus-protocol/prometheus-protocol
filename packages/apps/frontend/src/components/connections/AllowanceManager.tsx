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
  useAllowanceQuery,
  useBalanceQuery,
  useUpdateAllowanceMutation,
  useInitialPaymentSetupMutation,
  useTokenInfosQuery,
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
import { PublicResourceServer } from '@prometheus-protocol/ic-js';
import { isDefined } from '@/lib/utils';

const formSchema = z.object({
  budget: z.number().min(0, { message: 'Allowance cannot be negative.' }),
});

interface AllowanceManagerProps {
  resourceServer: PublicResourceServer;
  spenderPrincipal: Principal;
  onSuccess: () => void;
  submitButtonText: string;
  isSetupFlow: boolean;
  sessionId?: string; // Optional, only needed for setup flow
}

export function AllowanceManager({
  resourceServer,
  spenderPrincipal,
  onSuccess,
  submitButtonText,
  isSetupFlow,
  sessionId,
}: AllowanceManagerProps) {
  const { identity } = useInternetIdentity();
  const [selectedTokenId, setSelectedTokenId] = useState<string | undefined>(
    resourceServer.accepted_payment_canisters[0]?.toText(),
  );
  const selectedTokenPrincipal = useMemo(
    () => (selectedTokenId ? Principal.fromText(selectedTokenId) : undefined),
    [selectedTokenId],
  );

  const tokenInfoResults = useTokenInfosQuery(
    identity,
    resourceServer.accepted_payment_canisters,
  );
  const isTokenInfoLoading = tokenInfoResults.some((r) => r.isLoading);
  const tokenInfos = useMemo(
    () => tokenInfoResults.map((r) => r.data).filter(isDefined),
    [tokenInfoResults],
  );
  const selectedTokenInfo = tokenInfos.find(
    (t) => t?.canisterId.toText() === selectedTokenId,
  );

  const { data: balance, isLoading: isBalanceLoading } = useBalanceQuery(
    identity,
    selectedTokenPrincipal,
  );
  const { data: currentAllowance, isLoading: isAllowanceLoading } =
    useAllowanceQuery(identity, spenderPrincipal, selectedTokenPrincipal);

  const { mutate: initialSetup, isPending: isSettingUp } =
    useInitialPaymentSetupMutation();
  const { mutate: updateAllowance, isPending: isUpdating } =
    useUpdateAllowanceMutation();

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { budget: 0 },
  });

  useEffect(() => {
    if (currentAllowance !== undefined) {
      form.reset({ budget: currentAllowance });
    }
  }, [currentAllowance, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!identity || !spenderPrincipal || !selectedTokenPrincipal) return;

    if (isSetupFlow) {
      // In the setup flow, we need the session ID and call the initial setup mutation.
      if (!sessionId) {
        console.error('Session ID is required for setup flow.');
        return;
      }
      initialSetup(
        {
          identity,
          sessionId,
          amount: values.budget,
          spenderPrincipal,
          icrc2CanisterId: selectedTokenPrincipal,
        },
        { onSuccess },
      );
    } else {
      // In the management flow, we just update the allowance.
      updateAllowance(
        {
          identity,
          amount: values.budget,
          spenderPrincipal,
          icrc2CanisterId: selectedTokenPrincipal,
        },
        { onSuccess },
      );
    }
  }

  const isLoading =
    isTokenInfoLoading || isBalanceLoading || isAllowanceLoading;

  const isPending = isSettingUp || isUpdating;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Label>Payment Token</Label>
        <Select onValueChange={setSelectedTokenId} value={selectedTokenId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a payment token..." />
          </SelectTrigger>
          <SelectContent>
            {tokenInfos.map((token) => (
              <SelectItem
                key={token.canisterId.toText()}
                value={token.canisterId.toText()}>
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    New Allowance ({selectedTokenInfo?.symbol})
                  </FormLabel>
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
                    Your balance: {balance?.toFixed(2) ?? '...'}{' '}
                    {selectedTokenInfo?.symbol}
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
