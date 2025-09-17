import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { AuditBountyWithDetails } from '@prometheus-protocol/ic-js';
import { AttestationFormWrapper } from './AttestationFormWrapper';
import {
  useSubmitAttestation,
  useSubmitDivergence,
} from '@/hooks/useAuditBounties';

// 1. Define the Zod schema with conditional validation.
const formSchema = z
  .object({
    status: z.enum(['success', 'failure'], {
      error: 'You must select a status.',
    }),
    git_commit: z
      .string()
      .regex(/^[a-f0-9]{40}$/, 'Must be a valid 40-character git commit hash.'),
    repo_url: z.string().url('Must be a valid repository URL.'),
    failure_reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // 2. If status is 'failure', failure_reason must be provided.
    if (
      data.status === 'failure' &&
      (!data.failure_reason || data.failure_reason.length < 10)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['failure_reason'],
        message: 'A failure reason of at least 10 characters is required.',
      });
    }
  });

export const BuildReproducibilityAttestationForm = ({
  audit,
}: {
  audit: AuditBountyWithDetails;
}) => {
  // --- 2. Instantiate BOTH mutation hooks ---
  const { mutate: submitAttestation, isPending: isAttestationPending } =
    useSubmitAttestation();
  const { mutate: submitDivergence, isPending: isDivergencePending } =
    useSubmitDivergence();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: 'success',
      git_commit: '',
      repo_url: '',
      failure_reason: '',
    },
  });

  // 3. Watch the 'status' field to conditionally render the failure reason textarea.
  const status = form.watch('status');

  // --- 3. The onSubmit function is now the "traffic cop" ---
  function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.status === 'success') {
      // --- SUCCESS PATH ---
      const attestationData = {
        '126:audit_type': 'build_reproducibility_v1' as const,
        status: values.status,
        git_commit: values.git_commit,
        repo_url: values.repo_url,
      };
      submitAttestation({
        bountyId: audit.id,
        wasmId: audit.projectName, // Assuming projectName is the wasm_id
        attestationData,
      });
    } else {
      // --- FAILURE PATH ---
      submitDivergence({
        bountyId: audit.id,
        wasmId: audit.projectName,
        reason: values.failure_reason!, // Zod ensures this exists on failure
      });
    }
  }

  // --- 4. The overall pending state depends on EITHER mutation ---
  const isPending = isAttestationPending || isDivergencePending;

  return (
    <AttestationFormWrapper title="Submit Build Reproducibility Attestation">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Build Status</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1">
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="success" />
                      </FormControl>
                      <FormLabel className="font-normal">Success</FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="failure" />
                      </FormControl>
                      <FormLabel className="font-normal">Failure</FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="repo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repository URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., https://github.com/prometheus-protocol/mcp"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="git_commit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Git Commit Hash</FormLabel>
                <FormControl>
                  <Input placeholder="40-character SHA-1 hash" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 4. Conditionally render this field based on the watched status. */}
          {status === 'failure' && (
            <FormField
              control={form.control}
              name="failure_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Failure</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Explain why the build could not be reproduced..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full !mt-8"
            disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Attestation
          </Button>
        </form>
      </Form>
    </AttestationFormWrapper>
  );
};
