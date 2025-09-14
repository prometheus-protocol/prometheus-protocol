import { useState, useEffect, useMemo } from 'react';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// --- 1. Import the Check icon for feedback ---
import {
  User,
  LogOut,
  Loader2,
  Copy,
  Check,
  Wallet,
  Info,
  PackageCheckIcon,
  BadgeCheck,
  ToolCase,
  BookLock,
} from 'lucide-react';
import { truncatePrincipal } from '@/lib/utils';
import { TransferDialog } from './TransferDialog';
import { useGetTokenBalance } from '@/hooks/usePayment';
import { Tokens } from '@prometheus-protocol/ic-js';
import { useAuditorProfile } from '@/hooks/useAuditBounties';
import { ReputationBar } from './ReputationBar';

export const getReputationDisplayInfo = (auditType: string) => {
  // 'app_info_v1',
  // 'build_reproducibility_v1',
  // 'data_safety_v1',
  // 'tools_v1',
  switch (auditType) {
    case 'app_info_v1':
      return {
        name: 'App Info',
        icon: <Info className="h-4 w-4 text-muted-foreground" />,
      };
    case 'build_reproducibility_v1':
      return {
        name: 'Build Reproducibility',
        icon: <PackageCheckIcon className="h-4 w-4 text-muted-foreground" />,
      };
    case 'data_safety_v1':
      return {
        name: 'Data Safety',
        icon: <BookLock className="h-4 w-4 text-muted-foreground" />,
      };
    case 'tools_v1':
      return {
        name: 'Tool Details',
        icon: <ToolCase className="h-4 w-4 text-muted-foreground" />,
      };
    default:
      return {
        name: auditType,
        icon: <User className="h-4 w-4 text-muted-foreground" />,
      };
  }
};

export function LoginButton() {
  const { identity, login, clear, loginStatus } = useInternetIdentity();
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const { data: usdcBalance, isLoading: isBalanceLoading } = useGetTokenBalance(
    Tokens.USDC,
  );
  const { data: profile, isLoading: isProfileLoading } = useAuditorProfile();
  const usdcBalanceNum = Number(Tokens.USDC.fromAtomic(usdcBalance ?? 0n));

  // --- 2. Add state to track copy status ---
  const [isCopied, setIsCopied] = useState(false);

  // 2. Memoize the calculation for aggregated reputation data
  const aggregatedReputation = useMemo(() => {
    if (!profile) return [];

    // Get a unique set of all reputation types the user has (available or staked)
    const allReputationTypes = new Set([
      ...profile.available_balances.keys(),
      ...profile.staked_balances.keys(),
    ]);

    return Array.from(allReputationTypes).map((auditType) => {
      const available = profile.available_balances.get(auditType) ?? 0n;
      const staked = profile.staked_balances.get(auditType) ?? 0n;
      const total = available + staked;
      return {
        auditType,
        available: Number(available),
        total: Number(total),
      };
    });
  }, [profile]);

  // --- 3. Create a handler function for clarity ---
  const handleCopyPrincipal = (e: React.MouseEvent) => {
    if (!identity) return;
    e.preventDefault(); // Prevent the dropdown from closing

    const principalText = identity.getPrincipal().toText();
    navigator.clipboard.writeText(principalText);
    setIsCopied(true);
  };

  // --- 4. Use an effect to reset the 'isCopied' state after a delay ---
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000); // Reset after 2 seconds

      // Cleanup the timer if the component unmounts
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  if (loginStatus === 'logging-in') {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Logging in...
      </Button>
    );
  }

  // --- Logged In State (Updated) ---
  if (identity) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-10 w-10">
              <img
                src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${identity.getPrincipal().toText()}`}
                alt="Avatar"
                className="w-10 h-10 rounded-full bg-gray-800"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {' '}
            {/* Increased width for more content */}
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleCopyPrincipal}
              className="cursor-pointer flex justify-between items-center">
              <span className="text-sm text-foreground font-mono">
                {truncatePrincipal(identity.getPrincipal().toText())}
              </span>
              {isCopied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </DropdownMenuItem>
            {/* --- Balances Section --- */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Balances</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setIsTransferDialogOpen(true)}
              className="cursor-pointer flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span>USDC Balance</span>
              </div>
              {isBalanceLoading ? (
                <div className="h-4 w-12 bg-muted/50 rounded-sm animate-pulse" />
              ) : (
                <span className="font-mono font-semibold">
                  {usdcBalanceNum.toFixed(2) ?? '0.00'}
                </span>
              )}
            </DropdownMenuItem>
            {/* --- Reputation Section --- */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Reputation</DropdownMenuLabel>
            {isProfileLoading ? (
              <DropdownMenuItem disabled>
                <div className="h-10 w-full bg-muted/50 rounded-sm animate-pulse" />
              </DropdownMenuItem>
            ) : aggregatedReputation.length > 0 ? (
              aggregatedReputation.map(({ auditType, available, total }) => {
                const displayInfo = getReputationDisplayInfo(auditType);
                return (
                  <DropdownMenuItem
                    key={auditType}
                    disabled
                    className="opacity-100 focus:bg-transparent cursor-default flex flex-col items-start gap-1">
                    {/* Row 1: Icon and Name */}
                    <div className="flex items-center gap-1">
                      {displayInfo.icon}
                      <span className="text-xs text-foreground">
                        {displayInfo.name}
                      </span>
                    </div>
                    {/* Row 2: Reputation Bar */}
                    <ReputationBar available={available} total={total} />
                  </DropdownMenuItem>
                );
              })
            ) : (
              <DropdownMenuItem disabled className="opacity-100">
                <span className="text-xs text-muted-foreground">
                  No reputation earned yet.
                </span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={clear}
              className="text-red-500 focus:text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TransferDialog
          token={Tokens.USDC}
          isOpen={isTransferDialogOpen}
          onOpenChange={setIsTransferDialogOpen}
          currentBalance={usdcBalanceNum}
        />
      </>
    );
  }

  // --- Logged Out State (Default) ---
  return <Button onClick={login}>Login</Button>;
}
