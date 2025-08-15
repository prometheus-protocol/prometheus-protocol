import { useParams, useNavigate } from 'react-router-dom';
import {
  usePublicResourceServerQuery,
  useRevokeGrantMutation,
} from '@/hooks/useGrants';
import { Loader2, ServerCrash, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function ConnectionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: server, isLoading, isError } = usePublicResourceServerQuery(id);
  const { mutate: revokeGrant, isPending: isRevoking } =
    useRevokeGrantMutation();

  const handleRevoke = () => {
    if (!id) return;
    revokeGrant(id, {
      onSuccess: () => {
        // On successful revocation, navigate back to the main connections list
        navigate('/');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (isError || !server) {
    return (
      <div className="text-center p-12 text-destructive">
        <ServerCrash className="mx-auto h-12 w-12" />
        Error loading connection.
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-6">
      <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Connections
      </Button>

      <div className="text-center mb-8">
        <img
          src={server.logo_uri}
          alt={`${server.name} Logo`}
          className="w-24 h-24 mx-auto mb-4 rounded-lg object-contain"
        />
        <h1 className="text-3xl font-bold">{server.name}</h1>
        <p className="text-muted-foreground">
          Manage your allowance and permissions.
        </p>
      </div>

      <AllowanceManager
        resourceServer={server}
        spenderPrincipal={server.service_principals[0]}
        onSuccess={() => toast.success('Allowance updated successfully!')}
        submitButtonText="Update Allowance"
        isSetupFlow={false} // <-- Tell it this is NOT the setup flow
      />

      <div className="mt-12 border-t pt-6">
        <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
        <div className="flex items-center justify-between mt-2 p-4 border border-destructive/50 rounded-lg">
          <div>
            <h3 className="font-medium">Revoke Access</h3>
            <p className="text-sm text-muted-foreground">
              Permanently remove this connection.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isRevoking}>
                {isRevoking && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Revoke
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently revoke {server.name}'s ability to access
                  your account and initiate payments. This action cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRevoke}>
                  Yes, Revoke Access
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
