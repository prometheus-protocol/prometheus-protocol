import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'; // Import useLocation
import { useConfirmLoginMutation } from '@/hooks/useAuth';
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useInternetIdentity } from 'ic-use-internet-identity';

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation(); // <-- Get the location object

  const sessionId = searchParams.get('session_id');
  const { login, isLoggingIn, identity } = useInternetIdentity();
  const { confirmLogin, isConfirming, error } = useConfirmLoginMutation();
  const hasFiredRef = useRef(false);

  // This effect now handles BOTH login scenarios.
  useEffect(() => {
    if (
      !identity ||
      hasFiredRef.current ||
      isLoggingIn ||
      isConfirming ||
      error
    ) {
      return; // Exit if not ready or already processing
    }

    // SCENARIO 1: User is in an OAuth flow (session_id exists)
    if (sessionId) {
      hasFiredRef.current = true;
      confirmLogin(
        { identity, sessionId },
        {
          onSuccess: (data) => {
            if ('setup' in data.next_step) {
              navigate(`/setup?session_id=${sessionId}`, { state: data });
            } else if ('consent' in data.next_step) {
              navigate(`/consent?session_id=${sessionId}`, { state: data });
            }
          },
          onError: () => {
            hasFiredRef.current = false; // Reset on error to allow retry
          },
        },
      );
    }
    // SCENARIO 2: User is logging in to manage their connections (no session_id)
    else {
      // The user is logged in. Redirect them to the dashboard or wherever they were trying to go.
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [
    identity,
    sessionId,
    isConfirming,
    confirmLogin,
    navigate,
    isLoggingIn,
    error,
    location.state,
  ]);

  // This handler now works even without a session ID.
  const handleLoginClick = () => {
    login();
  };

  // Determine the correct text based on the context.
  const title = sessionId ? 'Log In to Continue' : 'Manage Your Connections';
  const description = sessionId
    ? 'This service requires you to log in with your Internet Identity.'
    : 'Log in to view and manage your application connections.';

  return (
    <Card className="w-full max-w-md py-2 sm:py-6">
      <CardHeader className="items-center text-center">
        <img
          src={'/ii.png'}
          alt="Internet Identity Logo"
          className="w-20 h-20 mb-4 rounded-lg object-contain mx-auto my-2"
        />
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <Button
          onClick={handleLoginClick}
          className="w-full"
          size="lg"
          disabled={isLoggingIn || isConfirming}>
          {(isLoggingIn || isConfirming) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isLoggingIn
            ? 'Opening II...'
            : isConfirming
              ? 'Confirming...'
              : 'Login with Internet Identity'}
        </Button>
      </CardContent>
    </Card>
  );
}
