import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useCompleteAuthorizeMutation } from '@/hooks/useAuth';
import { Check, Wallet, Loader2 } from 'lucide-react';
import { JSX } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';

// A small helper component to render each permission row
const PermissionRow = ({ scope }: { scope: string }) => {
  const scopeDetails: {
    [key: string]: { icon: JSX.Element; text: string; required?: boolean };
  } = {
    openid: {
      icon: <Check className="h-5 w-5 text-primary" />,
      text: 'View your user ID',
    },
    'prometheus:wallet': {
      icon: <Wallet className="h-5 w-5" />,
      text: 'Initiate payments via your Prometheus Wallet',
      required: true,
    },
    default: {
      icon: <Check className="h-5 w-5" />,
      text: `Unknown permission: ${scope}`,
    },
  };

  const details = scopeDetails[scope] || scopeDetails['default'];

  return (
    <div className="flex items-center p-3 bg-secondary rounded-md">
      <div className="mr-3">{details.icon}</div>
      <span className="flex-grow">{details.text}</span>
      {details.required && (
        <span className="text-xs font-semibold text-muted-foreground">
          (Required)
        </span>
      )}
    </div>
  );
};

export default function ConsentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const sessionId = searchParams.get('session_id');
  const { identity } = useInternetIdentity();
  const { mutate: completeAuthorize, isPending } =
    useCompleteAuthorizeMutation();

  // Get the client name and scopes from the navigation state
  const consentData = location.state?.consentData;
  const clientName = consentData?.client_name || '[Application Name]';
  const scopes = consentData?.scopes?.split(' ') || [
    'openid',
    'prometheus:wallet',
  ];

  const handleAllow = () => {
    if (!identity || !sessionId) {
      alert('Identity or session not found. Please log in again.');
      return;
    }

    completeAuthorize(
      { identity, sessionId },
      {
        onSuccess: (redirectUrl) => {
          // This is a full page redirect, not a client-side navigation
          window.location.href = redirectUrl;
        },
      },
    );
  };

  const handleDeny = () => {
    // TODO: Redirect back to the client app with an error
    alert('Permissions denied.');
    navigate('/login'); // For now, just go back to login
  };

  return (
    <Card className="w-full max-w-md border-border/60">
      <CardHeader>
        <CardTitle>Step 3: Grant Permissions</CardTitle>
        <CardDescription>
          <span className="font-bold">{clientName}</span> would like to:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          {scopes.map((scope: string) => (
            <PermissionRow key={scope} scope={scope} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={handleAllow} disabled={isPending} size="lg">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Allow
          </Button>
          <Button
            onClick={handleDeny}
            variant="outline"
            disabled={isPending}
            size="lg">
            Deny
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
