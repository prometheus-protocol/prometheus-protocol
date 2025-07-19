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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { useSetupPaymentMutation } from '@/hooks/usePayment';
import { useSessionInfoQuery } from '@/hooks/useSessionInfo';

// Define the form validation schema with Zod
const formSchema = z.object({
  budget: z.coerce
    .number()
    .positive({ message: 'Budget must be a positive number.' }),
});

export default function SetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('session_id');
  const { identity } = useInternetIdentity();

  const { mutate: setupPayment, isPending } = useSetupPaymentMutation();
  const { data: sessionInfo, isError } = useSessionInfoQuery(sessionId);

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { budget: 10.0 },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!identity || !sessionId || !sessionInfo) {
      alert('Required information not available. Please try again.');
      return;
    }

    setupPayment(
      {
        identity,
        sessionId,
        amount: values.budget,
        spenderPrincipal: sessionInfo.resource_server_principal,
      },
      {
        onSuccess: () => navigate(`/consent?session_id=${sessionId}`),
      },
    );
  }

  if (isError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>Could not load session information.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Step 2: Set Your Budget</CardTitle>
        <CardDescription>
          Activate your Prometheus account by setting a global spending budget
          for all apps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Global Budget (ckUSDC)</FormLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Approving...' : 'Approve Budget & Continue'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
