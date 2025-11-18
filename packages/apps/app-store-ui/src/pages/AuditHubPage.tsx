import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpenBountiesTab } from '@/components/audit-hub/OpenBountiesTab';
import { PendingVerificationsTab } from '@/components/audit-hub/PendingVerificationsTab';

export default function AuditHubPage() {
  const [activeTab, setActiveTab] = useState<'bounties' | 'pending'>(
    'bounties',
  );

  return (
    <div className="w-full max-w-6xl mx-auto pt-12 pb-24 text-gray-300">
      <nav className="text-sm text-muted-foreground mb-8">
        <Link to="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">Audit Hub</span>
      </nav>

      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Audit Hub
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-3xl">
          Track verifications and consensus progress for build reproducibility
          and MCP tools. Bounties are automatically created for all published
          apps and distributed when 9-of-9 verifiers participate.
        </p>
      </header>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'bounties' | 'pending')}
        className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px] mb-8">
          <TabsTrigger value="bounties">Open Bounties</TabsTrigger>
          <TabsTrigger value="pending">Pending Verifications</TabsTrigger>
        </TabsList>

        <TabsContent value="bounties">
          <OpenBountiesTab />
        </TabsContent>

        <TabsContent value="pending">
          <PendingVerificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
