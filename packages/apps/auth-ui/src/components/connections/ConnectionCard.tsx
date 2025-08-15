import { usePublicResourceServerQuery } from '@/hooks/useGrants';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

interface ConnectionCardProps {
  resourceServerId: string;
}

export const ConnectionCard = ({ resourceServerId }: ConnectionCardProps) => {
  const {
    data: server,
    isLoading,
    isError,
  } = usePublicResourceServerQuery(resourceServerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardHeader>
        <CardFooter>
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    );
  }

  if (isError || !server) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Error
          </CardTitle>
          <CardDescription>
            Could not load details for this connection.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-4">
        <img
          src={server.logo_uri}
          alt={`${server.name} Logo`}
          className="h-12 w-12 rounded-lg object-contain"
        />
        <div>
          <CardTitle>{server.name}</CardTitle>
          <CardDescription>
            {server.uris[0] ? new URL(server.uris[0]).hostname : 'Service'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardFooter>
        <Button asChild className="w-full">
          <Link to={`/connections/${resourceServerId}`}>Manage</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
