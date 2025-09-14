import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { AuditBountyWithDetails } from '@prometheus-protocol/ic-js';
import { AttestationFormWrapper } from './AttestationFormWrapper';
import { useSubmitAttestation } from '@/hooks/useAuditBounties';

// 1. Define the Zod schema for a single tool object.
const toolSchema = z.object({
  name: z.string().min(2, 'Tool name is required.'),
  cost: z.coerce.number().min(0, 'Cost cannot be negative.'),
  token: z
    .string()
    .min(2, 'Token symbol is required.')
    .transform((val) => val.toUpperCase()),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters.'),
});

// 2. Define the main form schema, which contains an array of tools.
const formSchema = z.object({
  tools: z.array(toolSchema).min(1, 'At least one tool must be provided.'),
});

export const ToolsAttestationForm = ({
  audit,
}: {
  audit: AuditBountyWithDetails;
}) => {
  const { mutate: submitAttestation, isPending } = useSubmitAttestation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      // Start with one empty tool entry for the user to fill out.
      tools: [{ name: '', cost: 0, token: 'USDC', description: '' }],
    },
  });

  // 3. Use the useFieldArray hook to manage the dynamic list of tools.
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tools',
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // 4. Transform the form data into the final attestation structure.
    const attestationData = {
      '126:audit_type': 'tools_v1' as const,
      // Convert the numeric cost back to a string with fixed decimal places.
      tools: values.tools.map((tool) => ({
        ...tool,
        cost: tool.cost.toFixed(2),
      })),
    };

    submitAttestation({
      bountyId: audit.id,
      wasmId: audit.projectName,
      attestationData,
    });
  }

  return (
    <AttestationFormWrapper title="Submit Tools & Resources Attestation">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-6">
            {/* 5. Iterate over the `fields` array to render each tool's form. */}
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="border border-border rounded-lg p-4 space-y-4 relative">
                <h3 className="text-lg font-semibold">Tool #{index + 1}</h3>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <FormField
                  control={form.control}
                  name={`tools.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tool Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Prometheus Metrics API"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`tools.${index}.cost`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`tools.${index}.token`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Symbol</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., USDC, ICP, BTC"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`tools.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what this tool does and when the cost is incurred."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() =>
              append({ name: '', cost: 0, token: 'USDC', description: '' })
            }>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Another Tool
          </Button>

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
