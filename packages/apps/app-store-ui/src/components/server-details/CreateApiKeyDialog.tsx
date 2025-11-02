// src/components/server-details/CreateApiKeyDialog.tsx

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, AlertTriangle } from 'lucide-react';
import { useCreateApiKey } from '@/hooks/useApiKeys';
import { AppVersionDetails } from '@prometheus-protocol/ic-js';
import { Principal } from '@icp-sdk/core/principal';

const formSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters.' }),
});

interface CreateApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  latestVersion: AppVersionDetails;
  canisterId: Principal;
}

export const CreateApiKeyDialog = ({
  isOpen,
  onOpenChange,
  latestVersion,
  canisterId,
}: CreateApiKeyDialogProps) => {
  const [newKey, setNewKey] = useState<string | null>(null);
  const { mutate: createKey, isPending: isCreatingKey } = useCreateApiKey();

  const form = useForm<z.input<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' },
  });

  // Reset state when the dialog is closed for a clean experience next time
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        form.reset();
        setNewKey(null);
      }, 200);
    }
  }, [open, form]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createKey(
      { serverPrincipal: canisterId, name: values.name },
      {
        onSuccess: ({ raw_key }) => setNewKey(raw_key),
        onError: (error) =>
          toast.error('Failed to create API key', {
            description: (error as Error).message,
          }),
      },
    );
  };

  const handleCopyToClipboard = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    toast.success('Copied to clipboard!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {newKey ? 'API Key Created Successfully' : 'Create New API Key'}
          </DialogTitle>
          <DialogDescription>
            {newKey
              ? 'Please copy this key and save it somewhere safe. You will not be able to see it again.'
              : 'Give your new key a descriptive name to help you identify it later.'}
          </DialogDescription>
        </DialogHeader>

        {newKey ? (
          // --- SUCCESS VIEW (Matches your new mockup) ---
          <div className="pt-4 space-y-4">
            <div className="flex items-start gap-4 p-3 border border-destructive/80 bg-destructive/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">
                This is the only time you will see this key. If you lose it, you
                will need to revoke it and create a new one.
              </p>
            </div>
            <div className="relative p-4 pr-12 border rounded-md bg-muted">
              <code className="text-sm break-all font-mono pr-10">
                {newKey}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={handleCopyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button className="w-full">I have copied my key</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          // --- FORM VIEW (Standard shadcn form) ---
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., My Research Agent" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isCreatingKey}>
                  {isCreatingKey && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Key
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
