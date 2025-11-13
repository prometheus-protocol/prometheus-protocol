// src/components/server-details/AccessAndBilling.tsx

import { useState } from 'react';
import { KeyRound, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useListApiKeys, useRevokeApiKey } from '@/hooks/useApiKeys';
import { AppVersionDetails } from '@prometheus-protocol/ic-js';
import { Principal } from '@icp-sdk/core/principal';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';

export const AccessAndBilling = ({
  latestVersion,
  canisterId,
}: {
  latestVersion: AppVersionDetails;
  canisterId?: Principal;
}) => {
  const { data: apiKeys = [], isLoading: isLoadingKeys } =
    useListApiKeys(canisterId);
  // We no longer need the create mutation here, it's in the dialog
  const { mutate: revokeKey, isPending: isRevoking } = useRevokeApiKey();

  // State for dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [revokeDialogState, setRevokeDialogState] = useState<{
    open: boolean;
    keyToRevoke: { hash: string; name: string } | null;
  }>({ open: false, keyToRevoke: null });

  // Don't try to access canisterId from latestVersion anymore
  if (!canisterId) {
    return null; // Don't render if no canister ID available
  }

  const handleRevokeKey = () => {
    if (!revokeDialogState.keyToRevoke) return;

    revokeKey(
      {
        serverPrincipal: canisterId,
        hashedKey: revokeDialogState.keyToRevoke.hash,
      },
      {
        onSuccess: () => {
          toast.success('API Key Revoked', {
            description: `The key "${revokeDialogState.keyToRevoke?.name}" has been successfully revoked.`,
          });
        },
        onError: (error) => {
          toast.error('Failed to revoke API key', {
            description: (error as Error).message,
          });
        },
        onSettled: () => {
          setRevokeDialogState({ open: false, keyToRevoke: null });
        },
      },
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3 mb-4">
            <KeyRound className="w-6 h-6" />
            API Keys
          </h2>
          <p className="text-muted-foreground">
            Create API keys for programmatic access to this app. These keys will
            use your token allowances managed in the Token Allowances section.
          </p>
        </div>

        <div className="space-y-4 ">
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Create New Key
          </Button>
          <div className="border rounded-lg min-h-[10rem] flex flex-col">
            {isLoadingKeys ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length > 0 ? (
              <ul className="divide-y">
                {apiKeys.map((key) => (
                  <li
                    key={key.hashed_key}
                    className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{key.info.name}</p>
                      <p className="font-mono text-xs text-muted-foreground mt-1">
                        {key.hashed_key.substring(0, 24)}...
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setRevokeDialogState({
                          open: true,
                          keyToRevoke: {
                            hash: key.hashed_key,
                            name: key.info.name,
                          },
                        })
                      }
                      disabled={isRevoking}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground p-3">
                You have not created any API keys for this service yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Dialogs are now rendered here, outside the main layout flow --- */}
      <CreateApiKeyDialog
        latestVersion={latestVersion}
        canisterId={canisterId}
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <AlertDialog
        open={revokeDialogState.open}
        onOpenChange={(open) =>
          !open && setRevokeDialogState({ open: false, keyToRevoke: null })
        }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke the API key{' '}
              <span className="font-bold">
                "{revokeDialogState.keyToRevoke?.name}"
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isRevoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
