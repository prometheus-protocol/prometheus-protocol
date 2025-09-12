import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuditHubErrorProps {
  onRetry: () => void;
}

export const AuditHubError = ({ onRetry }: AuditHubErrorProps) => (
  <div className="w-full max-w-6xl mx-auto py-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
    <AlertTriangle className="w-16 h-16 text-destructive/50 mb-6" />
    <h2 className="text-2xl font-bold text-white">Failed to Load Audits</h2>
    <p className="mt-2 text-muted-foreground max-w-md">
      There was a problem retrieving the audit hub data. Please check your
      connection and try again.
    </p>
    <div className="mt-6 flex gap-4">
      <Button onClick={onRetry}>Try Again</Button>
      <Button variant="outline" asChild>
        <Link to="/">Return to Home</Link>
      </Button>
    </div>
  </div>
);
