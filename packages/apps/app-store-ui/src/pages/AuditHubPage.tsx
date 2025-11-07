import { Link } from 'react-router-dom';
import { OpenBountiesTab } from '@/components/audit-hub/OpenBountiesTab';

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
          Track build verifications and consensus progress. Bounties are
          automatically created for all published apps and distributed when
          9-of-9 verifiers participate.
        </p>
      </header>

      <OpenBountiesTab />
    </div>
  );
}
