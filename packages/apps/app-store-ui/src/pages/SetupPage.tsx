import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSessionInfoQuery } from '@/hooks/useSessionInfo';
import { AllowanceManager } from '@/components/connections/AllowanceManager';
import { Principal } from '@dfinity/principal';
import { useMemo } from 'react';
import { Auth } from '@prometheus-protocol/declarations';

export default function SetupPage() {
  const { state } = useLocation();
  const sessionId = useSearchParams()[0].get('session_id');
  const navigate = useNavigate();

  const { data: sessionInfo, isLoading: isSessionLoading } =
    useSessionInfoQuery(sessionId);
  const spenderPrincipal = sessionInfo?.resource_server_principal;

  const rawCanisters = state?.accepted_payment_canisters || [];
  const acceptedPaymentCanisters: Principal[] = useMemo(
    () => rawCanisters.map((p: any) => Principal.from(p)),
    [rawCanisters],
  );

  // The consent_data from the session now contains all the info we need for the resource server.
  const resourceServer: Auth.PublicResourceServer | undefined =
    state?.consent_data
      ? {
          resource_server_id: state.consent_data.resource_server_id,
          name: state.consent_data.client_name, // Note the mapping from old field name
          logo_uri: state.consent_data.logo_uri,
          uris: [], // Not needed for this component
          scopes: state.consent_data.scopes,
          accepted_payment_canisters: acceptedPaymentCanisters,
          service_principals: [spenderPrincipal!], // We get this from sessionInfo
        }
      : undefined;

  const handleSuccess = () => {
    navigate(`/consent?session_id=${sessionId}`, { state });
  };

  const isLoading = isSessionLoading || !resourceServer || !spenderPrincipal;

  return (
    <Card className="w-full max-w-md py-2 sm:py-6">
      <CardHeader className="items-center text-center">
        {resourceServer?.logo_uri && (
          <img
            src={resourceServer.logo_uri}
            alt={`${resourceServer.name} Logo`}
            className="w-20 h-20 mb-4 rounded-lg object-contain mx-auto my-2"
          />
        )}
        <CardTitle className="text-2xl">Set Allowance</CardTitle>
        <CardDescription>
          Approve an allowance for{' '}
          <span className="font-bold">
            {resourceServer?.name || 'Unknown Server'}
          </span>{' '}
          to initiate payments on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AllowanceManager
            resourceServer={resourceServer}
            spenderPrincipal={spenderPrincipal}
            onSuccess={handleSuccess}
            submitButtonText="Approve & Continue"
            isSetupFlow={true} // <-- Tell it this is the setup flow
            sessionId={sessionId!} // <-- Provide the session ID
          />
        )}
      </CardContent>
    </Card>
  );
}
