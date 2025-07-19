import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useConfirmLoginMutation } from '@/hooks/useAuth';
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useInternetIdentity } from 'ic-use-internet-identity';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();

  const { login, isLoggingIn, identity } = useInternetIdentity();
  const { confirmLogin, isConfirming, error } = useConfirmLoginMutation();
  const hasFiredRef = useRef(false);

  useEffect(() => {
    // Your excellent, robust condition is kept as is.
    if (
      identity &&
      sessionId &&
      !isConfirming &&
      !hasFiredRef.current &&
      !isLoggingIn &&
      !error
    ) {
      hasFiredRef.current = true;
      confirmLogin(
        { identity, sessionId },
        {
          onSuccess: (data) => {
            console.log(
              'Login confirmed, navigating to next step:',
              data.next_step,
            );

            if ('setup' in data.next_step) {
              navigate(`/setup?session_id=${sessionId}`, {
                state: data,
              });
            } else if ('consent' in data.next_step) {
              navigate(`/consent?session_id=${sessionId}`, {
                state: data,
              });
            }
          },
          onError: () => {
            hasFiredRef.current = false;
          },
        },
      );
    }
  }, [
    identity,
    sessionId,
    isConfirming,
    confirmLogin,
    navigate,
    isLoggingIn,
    error,
  ]);

  const handleLoginClick = () => {
    if (!sessionId) {
      alert('Session ID is missing. Cannot proceed.');
      return;
    }
    login();
  };

  // Your JSX is perfect.
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Step 1: Log In</CardTitle>
        <CardDescription>
          Please log in with Internet Identity to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Session ID: {sessionId || 'Not Found'}
        </p>
        <Button
          onClick={handleLoginClick}
          className="w-full"
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
