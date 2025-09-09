import { useInternetIdentity } from 'ic-use-internet-identity';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Loader2, Computer } from 'lucide-react';
import { truncatePrincipal } from '@/lib/utils';

export function LoginButton() {
  const { identity, login, clear, loginStatus } = useInternetIdentity();
  const navigate = useNavigate();

  // --- Loading State ---
  if (loginStatus === 'logging-in') {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Logging in...
      </Button>
    );
  }

  // --- Logged In State ---
  if (identity) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="rounded-full">
            <img
              src={`https://api.dicebear.com/8.x/pixel-art/svg?seed=${identity.getPrincipal().toText()}`}
              alt="Avatar"
              className="w-8 h-8 rounded-full bg-gray-800 p-1"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-54">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <span className="text-sm text-foreground">
              {truncatePrincipal(identity.getPrincipal().toText())}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={clear}
            className="text-red-500 focus:text-red-500">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // --- Logged Out State (Default) ---
  return <Button onClick={login}>Login</Button>;
}
