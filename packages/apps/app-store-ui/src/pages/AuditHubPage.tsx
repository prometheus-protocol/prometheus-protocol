import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OpenBountiesTab } from '@/components/audit-hub/OpenBountiesTab';
import { PendingVerificationsTab } from '@/components/audit-hub/PendingVerificationsTab';

export default function AuditHubPage() {
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
          Explore open audits, claim bounties, and earn rewards for securing the
          trust layer of the AI agent ecosystem.
        </p>
      </header>

      <Tabs defaultValue="bounties" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="bounties">Open Bounties</TabsTrigger>
          <TabsTrigger value="verifications">Pending Verifications</TabsTrigger>
        </TabsList>

        <TabsContent value="bounties">
          <OpenBountiesTab />
        </TabsContent>

        <TabsContent value="verifications">
          <PendingVerificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
