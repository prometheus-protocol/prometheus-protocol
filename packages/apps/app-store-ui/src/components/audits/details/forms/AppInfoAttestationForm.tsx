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
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { AuditBountyWithDetails } from '@prometheus-protocol/ic-js';
import { AttestationFormWrapper } from './AttestationFormWrapper';
import { useSubmitAttestation } from '@/hooks/useAuditBounties';

// 1. Define the Zod schema for the form, matching the attestation data structure.
const formSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters.'),
  publisher: z.string().min(3, 'Publisher must be at least 3 characters.'),
  mcp_path: z.string().startsWith('/', 'Path must start with a "/"'),
  category: z.string().min(2, 'Category is required.'),
  icon_url: z.string().url('Must be a valid URL.'),
  banner_url: z.string().url('Must be a valid URL.'),
  gallery_images: z
    .string()
    .min(1, 'At least one gallery image URL is required.'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters.'),
  key_features: z.string().min(1, 'At least one key feature is required.'),
  why_this_app: z
    .string()
    .min(10, 'This field is required. 10 characters min.'),
  tags: z.string().min(1, 'At least one tag is required.'),
});

// Helper to split textarea lines into an array
const splitLines = (text: string) =>
  text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
const splitCommas = (text: string) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const AppInfoAttestationForm = ({
  audit,
}: {
  audit: AuditBountyWithDetails;
}) => {
  const { mutate: submitAttestation, isPending } = useSubmitAttestation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      publisher: '',
      mcp_path: '/mcp',
      category: '',
      icon_url: '',
      banner_url: '',
      gallery_images: '',
      description: '',
      key_features: '',
      why_this_app: '',
      tags: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // 2. Transform the form data into the final attestation structure.
    const attestationData = {
      '126:audit_type': 'app_info_v1' as const,
      ...values,
      gallery_images: splitLines(values.gallery_images),
      key_features: splitLines(values.key_features),
      tags: splitCommas(values.tags),
    };

    // 3. Call the mutation hook.
    submitAttestation({
      bountyId: audit.id,
      wasmId: audit.projectName, // Assuming projectName is the wasmId/hash
      attestationData,
    });
  }

  return (
    <AttestationFormWrapper title="Submit App Info Attestation">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Using a grid for better layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="publisher"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Publisher</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Productivity, Games" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mcp_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MCP Path</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="key_features"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Key Features</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormDescription>Enter one feature per line.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>
                  Enter tags separated by commas.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="icon_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon URL</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="banner_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Banner URL</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gallery_images"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gallery Image URLs</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormDescription>Enter one URL per line.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="why_this_app"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Why This App?</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
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
            Submit Attestation
          </Button>
        </form>
      </Form>
    </AttestationFormWrapper>
  );
};
