import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  useSetupPaymentMutation,
  useBalanceQuery,
  useAllowanceQuery,
  useTokenInfosQuery,
} from '@/hooks/usePayment';
import { useSessionInfoQuery } from '@/hooks/useSessionInfo';
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
import { CopyablePrincipal } from '@/components/ui/copyable-principal';

const formSchema = z.object({
  budget: z.coerce
    .number()
    .min(0, { message: 'Allowance cannot be negative.' }),
});

export default function SetupPage() {
  // --- Hooks & State (No changes here) ---
  const { state } = useLocation();
  const { identity } = useInternetIdentity();
  const sessionId = useSearchParams()[0].get('session_id');
  const navigate = useNavigate();

  const consentData = state?.consent_data;
  const resourceServerName = consentData?.client_name || 'the application';
  const resourceServerLogo = consentData?.logo_uri;

  const rawCanisters = state?.accepted_payment_canisters || [];
  const acceptedPaymentCanisters: Principal[] = useMemo(
    () => rawCanisters.map((p: any) => Principal.from(p)),
    [rawCanisters],
  );

  const [selectedTokenId, setSelectedTokenId] = useState<string | undefined>(
    acceptedPaymentCanisters[0]?.toText(),
  );
  const selectedTokenPrincipal = useMemo(
    () => (selectedTokenId ? Principal.fromText(selectedTokenId) : undefined),
    [selectedTokenId],
  );

  // --- Data Fetching & Form Logic (No changes here) ---
  const { data: sessionInfo, isLoading: isSessionLoading } =
    useSessionInfoQuery(sessionId);
  const spenderPrincipal = sessionInfo?.resource_server_principal;
  const tokenInfoResults = useTokenInfosQuery(
    identity,
    acceptedPaymentCanisters,
  );
  const isTokenInfoLoading = tokenInfoResults.some((r) => r.isLoading);
  const tokenInfos = useMemo(
    () => tokenInfoResults.map((r) => r.data).filter(Boolean),
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
  const { mutate: setupPayment, isPending: isSettingAllowance } =
    useSetupPaymentMutation();
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
    if (
      !identity ||
      !sessionId ||
      !spenderPrincipal ||
      !selectedTokenPrincipal
    ) {
      alert('Required information not available. Please try again.');
      return;
    }
    setupPayment(
      {
        identity,
        sessionId,
        amount: values.budget,
        spenderPrincipal,
        icrc2CanisterId: selectedTokenPrincipal,
      },
      {
        onSuccess: () =>
          navigate(`/consent?session_id=${sessionId}`, { state }),
      },
    );
  }
  const isLoading =
    isSessionLoading ||
    isBalanceLoading ||
    isAllowanceLoading ||
    isTokenInfoLoading;

  return (
    <Card className="w-full max-w-md py-2 sm:py-6">
      <CardHeader className="items-center text-center">
        {resourceServerLogo && (
          <img
            src={resourceServerLogo}
            alt={`${resourceServerName} Logo`}
            className="w-20 h-20 mb-4 rounded-lg object-contain mx-auto my-2"
          />
        )}
        <CardTitle className="text-2xl">{resourceServerName}</CardTitle>
        <CardDescription>
          Approve an allowance for this service to initiate payments on your
          behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-8">
        {identity && (
          <div className="space-y-2">
            <Label>Your Principal ID (Wallet Address)</Label>
            <CopyablePrincipal principal={identity.getPrincipal()} />
            <p className="text-xs text-muted-foreground">
              Use this ID to transfer funds to your wallet if your balance is
              low.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Payment Token</Label>
          <Select onValueChange={setSelectedTokenId} value={selectedTokenId}>
            <SelectTrigger className="w-full">
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
                disabled={isSettingAllowance}>
                {isSettingAllowance && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSettingAllowance ? 'Approving...' : 'Approve & Continue'}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
