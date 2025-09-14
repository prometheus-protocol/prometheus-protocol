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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { AuditBountyWithDetails } from '@prometheus-protocol/ic-js';
import { AttestationFormWrapper } from './AttestationFormWrapper';
import { useSubmitAttestation } from '@/hooks/useAuditBounties';

// A constant for the categories to keep the code clean
const DATA_SAFETY_CATEGORIES = [
  'Data Collection',
  'Data Sharing',
  'Security Practices',
  'Data Retention',
] as const;

// 1. Define the Zod schema for a single data point object.
const dataPointSchema = z.object({
  category: z.enum(DATA_SAFETY_CATEGORIES),
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters.'),
});

// 2. Define the main form schema.
const formSchema = z.object({
  overall_description: z.string().min(10, 'Overall description is required.'),
  data_points: z
    .array(dataPointSchema)
    .min(1, 'At least one data point must be provided.'),
});

export const DataSafetyAttestationForm = ({
  audit,
}: {
  audit: AuditBountyWithDetails;
}) => {
  const { mutate: submitAttestation, isPending } = useSubmitAttestation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      overall_description: '',
      // Start with one empty data point for the user.
      data_points: [
        {
          category: 'Data Collection',
          title: '',
          description: '',
        },
      ],
    },
  });

  // 3. Use useFieldArray to manage the dynamic list of data points.
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'data_points',
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // 4. The form data already matches the target structure, so we just wrap it.
    const attestationData = {
      '126:audit_type': 'data_safety_v1' as const,
      overall_description: values.overall_description,
      data_points: values.data_points,
    };

    submitAttestation({
      bountyId: audit.id,
      wasmId: audit.projectName,
      attestationData,
    });
  }

  return (
    <AttestationFormWrapper title="Submit Data Safety Attestation">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="overall_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Overall Summary</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Provide a high-level, one-sentence summary of the app's data handling practices."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-6">
            {/* 5. Iterate over the `fields` array to render each data point's form. */}
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="border border-border rounded-lg p-4 space-y-4 relative">
                <h3 className="text-lg font-semibold">
                  Data Point #{index + 1}
                </h3>
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
                  name={`data_points.${index}.category`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DATA_SAFETY_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`data_points.${index}.title`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Temporary Location Use"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`data_points.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe this specific data practice in detail."
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
              append({
                category: 'Data Collection',
                title: '',
                description: '',
              })
            }>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Another Data Point
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
