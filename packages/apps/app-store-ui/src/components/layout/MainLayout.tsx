import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, User } from 'lucide-react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { LoginButton } from '../LoginButton';
import { Footer } from './Footer';
import { Logo } from '../Logo';
import { AppBar } from './AppBar';

export function MainLayout() {
  const { identity, login, clear, isLoggingIn } = useInternetIdentity();
  const navigate = useNavigate();

  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      {/* --- Header --- */}
      <AppBar />

      {/* --- Main Content --- */}
      {/* The Outlet component from React Router will render the active page component here */}
      <main className="flex-1 px-6 sm:px-8 lg:px-16">
        <div className="container py-12 mx-auto">
          <Outlet />
        </div>
      </main>

      {/* --- Footer --- */}
      <Footer />
    </div>
  );
}
