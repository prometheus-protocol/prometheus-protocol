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
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useInternetIdentity } from 'ic-use-internet-identity';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get('session_id');
  const { login, isLoggingIn, identity } = useInternetIdentity();
  const { confirmLogin, isConfirming, error } = useConfirmLoginMutation();
  const hasFiredRef = useRef(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // This effect handles the OAuth confirmation flow after identity is obtained.
  useEffect(() => {
    if (
      !identity ||
      !sessionId ||
      hasFiredRef.current ||
      isConfirming ||
      error
    ) {
      return; // Exit if not ready or already processing
    }

    hasFiredRef.current = true;
    confirmLogin(
      { identity, sessionId },
      {
        onSuccess: (data) => {
          setIsRedirecting(true);
          if ('setup' in data.next_step) {
            navigate(`/oauth/setup?session_id=${sessionId}`, { state: data });
          } else if ('consent' in data.next_step) {
            navigate(`/oauth/consent?session_id=${sessionId}`, {
              state: data,
            });
          }
        },
        onError: () => {
          hasFiredRef.current = false; // Reset on error to allow retry
        },
      },
    );
  }, [identity, sessionId, isConfirming, confirmLogin, navigate, error]);

  // This handler triggers the Internet Identity login.
  const handleLoginClick = () => {
    login();
  };

  return (
    <Card className="w-full max-w-md sm:py-6 pt-8 m-auto my-12">
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
          disabled={isLoggingIn || isConfirming || isRedirecting}>
          {(isLoggingIn || isConfirming || isRedirecting) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isLoggingIn
            ? 'Opening II...'
            : isConfirming
              ? 'Confirming...'
              : isRedirecting
                ? 'Redirecting...'
                : 'Login with Internet Identity'}
        </Button>
      </CardContent>
    </Card>
  );
}
