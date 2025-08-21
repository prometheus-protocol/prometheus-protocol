import { useInternetIdentity } from 'ic-use-internet-identity';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { identity, isInitializing } = useInternetIdentity();
  const location = useLocation();

  // While the identity is being loaded from storage, show a loading spinner.
  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If initialization is complete and there is no identity, the user is not logged in.
  // Redirect them to the login page.
  if (!identity) {
    // We can pass the original location they tried to visit in the state.
    // The login page could potentially use this to redirect them back after login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If the user is logged in, render the requested page.
  return <>{children}</>;
}
