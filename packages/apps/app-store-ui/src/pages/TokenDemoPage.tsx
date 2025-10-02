import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { TokenManager } from '@/components/TokenManager';
import { TokenListExample } from '@/components/TokenListExample';
import { useTokenRegistry } from '@/hooks/useTokenRegistry';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Wallet, Shield } from 'lucide-react';

export default function TokenDemoPage() {
  const { identity, login } = useInternetIdentity();
  const { tokens, isLoading, error, refetch } = useTokenRegistry();

  // Demo target principal (replace with actual app canister ID)
  const demoTargetPrincipal = Principal.fromText('rdmx6-jaaaa-aaaaa-aaadq-cai');

  // Tokens are loaded automatically by React Query

  if (!identity) {
    return (
      <div className="container mx-auto py-16 max-w-4xl">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Token Wallet Demo</h1>
          <p className="text-muted-foreground">
            Please log in to demonstrate the token management functionality.
          </p>
          <Button onClick={login} size="lg">
            Login with Internet Identity
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-16 max-w-6xl space-y-8">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-bold">Token Wallet Demo</h1>
        <p className="text-muted-foreground text-lg">
          Demonstration of the token management functionality for Prometheus
          Protocol apps.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This is a demonstration of the token wallet functionality. The target
          canister used here is a demo canister. In a real app, this would be
          the principal of the MCP server canister you're interacting with.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="allowances" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="allowances" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Token Allowances
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Canister Wallet
          </TabsTrigger>
          <TabsTrigger value="registry">Token Registry & Search</TabsTrigger>
        </TabsList>

        <TabsContent value="allowances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Token Allowances Demo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage the allowances you've granted to the demo app. This is
                what end users would see to control how much of their tokens an
                app can spend.
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  Loading token registry...
                </div>
              ) : error ? (
                <div className="text-red-500 py-4">Error: {error}</div>
              ) : (
                <TokenManager
                  mode="allowance"
                  targetPrincipal={demoTargetPrincipal}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Canister Wallet Demo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage the tokens held by the demo canister. This is what app
                developers/owners would see to manage their app's treasury.
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  Loading token registry...
                </div>
              ) : error ? (
                <div className="text-red-500 py-4">Error: {error}</div>
              ) : (
                <TokenManager
                  mode="balance"
                  targetPrincipal={demoTargetPrincipal}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registry" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Enhanced Token Registry</CardTitle>
              <p className="text-sm text-muted-foreground">
                Explore the comprehensive token registry with pagination,
                search, and metadata features. This demonstrates both
                server-side and client-side search capabilities.
              </p>
            </CardHeader>
            <CardContent>
              <TokenListExample />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="border-t pt-8 space-y-4">
        <h3 className="text-lg font-semibold">Implementation Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-medium">Token Allowances Mode:</h4>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Always visible to logged-in users</li>
              <li>Uses ICRC-2 standard for allowance management</li>
              <li>Stores watched tokens in localStorage</li>
              <li>Real-time balance and allowance fetching</li>
              <li>Enhanced token search with logos</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Canister Wallet Mode:</h4>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Only visible to app owners/developers</li>
              <li>Shows all tokens with non-zero balances</li>
              <li>Supports withdraw functionality</li>
              <li>Uses ICRC-1 standard for balance checking</li>
              <li>Token metadata integration</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Enhanced Token Registry:</h4>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Pagination support for large token lists</li>
              <li>Server-side and client-side search</li>
              <li>Token logos and metadata display</li>
              <li>Real-time filtering capabilities</li>
              <li>Comprehensive token information</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
