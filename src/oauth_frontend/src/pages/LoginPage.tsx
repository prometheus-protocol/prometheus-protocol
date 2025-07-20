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
  // --- Hooks & Logic (No changes here) ---
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const { login, isLoggingIn, identity } = useInternetIdentity();
  const { confirmLogin, isConfirming, error } = useConfirmLoginMutation();
  const hasFiredRef = useRef(false);

  useEffect(() => {
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
            if ('setup' in data.next_step) {
              navigate(`/setup?session_id=${sessionId}`, { state: data });
            } else if ('consent' in data.next_step) {
              navigate(`/consent?session_id=${sessionId}`, { state: data });
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

  return (
    <Card className="w-full max-w-md py-2 sm:py-6">
      <CardHeader className="items-center text-center">
        <img
          src={'/ii.png'}
          alt="Internet Identity Logo"
          className="w-20 h-20 mb-4 rounded-lg object-contain mx-auto my-2"
        />
        <CardTitle className="text-2xl">Log In to Continue</CardTitle>
        <CardDescription>
          This service requires you to log in with your Internet Identity.
        </CardDescription>
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
