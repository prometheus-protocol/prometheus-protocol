import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StakeManagementTab } from '@/components/verifier-dashboard/StakeManagementTab';
import { ApiKeysTab } from '@/components/verifier-dashboard/ApiKeysTab';
import { VerifierStatsTab } from '@/components/verifier-dashboard/VerifierStatsTab';

export default function VerifierDashboardPage() {
  return (
    <div className="w-full max-w-6xl mx-auto pt-12 pb-24 text-gray-300">
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">Verifier Dashboard</span>
      </nav>

      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Verifier Dashboard
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-3xl">
          Manage your USDC stake, API keys, and view your verification
          statistics. Automated build verification rewards are distributed after
          consensus is reached.
        </p>
      </header>

      <Tabs defaultValue="stake" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="stake">Stake Management</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="stake">
          <StakeManagementTab />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>

        <TabsContent value="stats">
          <VerifierStatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
