import { useMyGrantsQuery } from '@/hooks/useGrants';
import { Loader2, LogOut, ServerCrash } from 'lucide-react';
import { ConnectionCard } from '@/components/connections/ConnectionCard'; // We will create this next
import { Button } from '@/components/ui/button';
import { useInternetIdentity } from 'ic-use-internet-identity';

export default function ConnectionsPage() {
  const { data: grantIds, isLoading, isError, error } = useMyGrantsQuery();
  const { clear } = useInternetIdentity();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p className="mt-4 text-lg">Loading your connections...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <ServerCrash className="h-12 w-12" />
        <p className="mt-4 text-lg">Failed to load connections</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6">
      {/* --- 3. UPDATED HEADER SECTION --- */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Your Connections
          </h1>
          <p className="text-muted-foreground">
            Manage permissions and allowances for applications you've connected.
          </p>
        </div>
        <Button variant="outline" onClick={clear}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>

      {grantIds && grantIds.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {grantIds.map((id) => (
            <ConnectionCard key={id} resourceServerId={id} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold">No active connections</h2>
          <p className="text-muted-foreground mt-2">
            When you connect to a new application, it will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
