import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  useCompleteAuthorizeMutation,
  useDenyConsentMutation,
} from '@/hooks/useAuth';
import {
  Check,
  FileLock2,
  Loader2,
  Eye,
  Pencil,
  Trash2,
  User,
  CreditCard,
} from 'lucide-react';
import { JSX, useMemo } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';

// --- Types and Data Structures ---
type ScopeData = { id: string; description: string };
type GroupedScopes = { [groupName: string]: ScopeData[] };

// --- Helper Components ---
const PermissionRow = ({ scopeData }: { scopeData: ScopeData }) => {
  const { id, description } = scopeData;
  const getIcon = (scopeId: string): JSX.Element => {
    if (scopeId === 'openid') return <User className="h-5 w-5 text-primary" />;
    if (scopeId === 'prometheus:charge')
      return <FileLock2 className="h-5 w-5 text-primary" />;
    if (scopeId.includes('read')) return <Eye className="h-5 w-5" />;
    if (scopeId.includes('write')) return <Pencil className="h-5 w-5" />;
    if (scopeId.includes('delete')) return <Trash2 className="h-5 w-5" />;
    if (scopeId.includes('billing')) return <CreditCard className="h-5 w-5" />;
    return <Check className="h-5 w-5" />;
  };
  return (
    <div className="flex items-start">
      <div className="mr-4 mt-1 flex-shrink-0 text-muted-foreground">
        {getIcon(id)}
      </div>
      <span className="flex-grow text-sm">{description}</span>
    </div>
  );
};
const PermissionGroup = ({
  title,
  scopes,
}: {
  title: string;
  scopes: ScopeData[];
}) => (
  <div className="space-y-3 rounded-lg border border-border/40 bg-background p-4">
    <h4 className="font-semibold text-sm capitalize">{title}</h4>
    <div className="space-y-3 pl-2">
      {scopes.map((scope) => (
        <PermissionRow key={scope.id} scopeData={scope} />
      ))}
    </div>
  </div>
);

// --- Main Component ---
export default function ConsentPage() {
  // --- Hooks & Logic ---
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const sessionId = searchParams.get('session_id');
  const { identity } = useInternetIdentity();
  const { mutate: completeAuthorize, isPending: isAllowing } =
    useCompleteAuthorizeMutation();
  const { denyConsent, isDenying } = useDenyConsentMutation();
  const consentData = location.state?.consent_data;
  const resourceServerName = consentData?.client_name || '[Application Name]';
  const resourceServerLogo = consentData?.logo_uri;
  const allScopes: ScopeData[] = consentData?.scopes || [];
  const { foundationalScopes, applicationScopes } = useMemo(() => {
    const foundational: ScopeData[] = [];
    const application: GroupedScopes = {};
    allScopes.forEach((scope) => {
      if (scope.id === 'openid' || scope.id === 'prometheus:charge') {
        foundational.push(scope);
      } else {
        const [groupName] = scope.id.split(':');
        if (!application[groupName]) {
          application[groupName] = [];
        }
        application[groupName].push(scope);
      }
    });
    return { foundationalScopes: foundational, applicationScopes: application };
  }, [allScopes]);
  const handleAllow = () => {
    if (!identity || !sessionId) {
      alert('Identity or session not found. Please log in again.');
      return;
    }
    completeAuthorize(
      { identity, sessionId },
      {
        onSuccess: (redirectUrl) => {
          window.location.href = redirectUrl;
        },
      },
    );
  };
  const handleDeny = () => {
    if (!identity || !sessionId) return;
    denyConsent(
      { identity, sessionId },
      {
        onSuccess: (redirectUrl) => {
          window.location.href = redirectUrl;
        },
      },
    );
  };
  const isPending = isAllowing || isDenying;

  return (
    <Card className="w-full max-w-md py-2 sm:py-6">
      <CardHeader className="items-center text-center">
        {resourceServerLogo && (
          <img
            src={resourceServerLogo}
            alt={`${resourceServerName} Logo`}
            className="w-20 h-20 mb-4 rounded-lg object-contain mx-auto my-2"
          />
        )}
        <CardTitle className="text-2xl">Grant Permissions</CardTitle>
        <CardDescription>
          <span className="font-bold">{resourceServerName}</span> is requesting
          the following permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-8">
        <div className="space-y-4">
          {/* Render Foundational Scopes First */}
          {foundationalScopes.length > 0 && (
            <div className="space-y-3 rounded-lg bg-secondary p-4">
              <h4 className="font-semibold text-sm">
                Foundational Permissions
              </h4>
              <div className="space-y-3 pt-2">
                {foundationalScopes.map((scope) => (
                  <PermissionRow key={scope.id} scopeData={scope} />
                ))}
              </div>
            </div>
          )}

          {/* Render Grouped Application Scopes */}
          {Object.entries(applicationScopes).map(([groupName, scopes]) => (
            <PermissionGroup
              key={groupName}
              title={`${groupName} Access`}
              scopes={scopes}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={handleAllow} disabled={isPending} size="lg">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Allow Access
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
