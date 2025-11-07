import { useState } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useListApiKeys,
  useGenerateApiKey,
  useRevokeApiKey,
} from '@/hooks/useVerifierDashboard';
import { AuditHub } from '@prometheus-protocol/declarations';

export function ApiKeysTab() {
  const { identity } = useInternetIdentity();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // Fetch API keys
  const { data: apiKeys = [], isLoading } = useListApiKeys();

  // Mutations
  const generateMutation = useGenerateApiKey();
  const revokeMutation = useRevokeApiKey();

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const maskKey = (key: string) => {
    return key.substring(0, 8) + '•'.repeat(24);
  };

  const handleGenerate = () => {
    generateMutation.mutate(undefined, {
      onSuccess: (newKey: string) => {
        toast.success(
          "New API key generated! Make sure to copy it now - you won't see it again.",
        );
        // Auto-show the new key
        setVisibleKeys(new Set([newKey]));
      },
    });
  };

  const handleRevoke = (apiKey: string) => {
    if (
      confirm(
        'Are you sure you want to revoke this API key? This action cannot be undone.',
      )
    ) {
      revokeMutation.mutate({ apiKey });
    }
  };

  if (!identity) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-center text-muted-foreground">
            Please connect your wallet to manage API keys.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate New Key Section */}
      <Card>
        <CardHeader>
          <CardTitle>Generate New API Key</CardTitle>
          <CardDescription>
            Create a new API key for use with the verifier bot. Each key is
            associated with your principal and can be revoked at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}>
            {generateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <Plus className="mr-2 h-4 w-4" />
            Generate New Key
          </Button>
        </CardContent>
      </Card>

      {/* Existing Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            Manage your existing API keys. Keep these secure and never share
            them publicly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No API keys yet. Generate one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>API Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((apiKey: AuditHub.ApiCredential) => (
                  <TableRow key={apiKey.api_key}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        {visibleKeys.has(apiKey.api_key)
                          ? apiKey.api_key
                          : maskKey(apiKey.api_key)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleVisibility(apiKey.api_key)}>
                          {visibleKeys.has(apiKey.api_key) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(
                        Number(apiKey.created_at / 1_000_000n),
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {apiKey.last_used &&
                      apiKey.last_used.length > 0 &&
                      apiKey.last_used[0]
                        ? new Date(
                            Number(apiKey.last_used[0] / 1_000_000n),
                          ).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(apiKey.api_key)}>
                          {copiedKey === apiKey.api_key ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleRevoke(apiKey.api_key)}
                          disabled={revokeMutation.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Using Your API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Verifier Bot Configuration</h4>
            <p className="text-sm text-muted-foreground mb-2">
              Set your API key as an environment variable in your verifier bot:
            </p>
            <code className="block bg-muted p-3 rounded text-sm font-mono">
              VERIFIER_API_KEY=vr_your_api_key_here
            </code>
          </div>
          <div>
            <h4 className="font-medium mb-2">Security Best Practices</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Never commit API keys to version control</li>
              <li>Use environment variables or secret managers</li>
              <li>Rotate keys periodically for enhanced security</li>
              <li>Revoke keys immediately if compromised</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
