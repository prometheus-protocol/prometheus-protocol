import { useState, useEffect, useRef } from 'react';
// --- 1. Import NavLink instead of Link for active state handling ---
import { Link, useLocation } from 'react-router-dom';
import { LoginButton } from '../LoginButton';
import { Logo } from '../Logo';
import { SearchInput } from '../SearchInput';
import { Search, X, Menu } from 'lucide-react';
import { Button } from '../ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import React from 'react';

interface ListItemProps extends React.HTMLAttributes<HTMLAnchorElement> {
  title: string;
  children: React.ReactNode;
  href?: string; // For standard external links
  to?: string; // For internal React Router links
}

const ListItem = React.forwardRef<HTMLAnchorElement, ListItemProps>(
  ({ className, title, children, href, to, ...props }, ref) => {
    // Combine common props to avoid repetition
    const commonProps = {
      ref,
      className: cn(
        'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
        className,
      ),
      ...props,
    };

    // The content is the same for both link types
    const content = (
      <>
        <div className="text-sm font-medium leading-none">{title}</div>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
          {children}
        </p>
      </>
    );

    return (
      <li>
        <NavigationMenuLink asChild>
          {/* If a 'to' prop is provided, render a React Router Link. */}
          {to ? (
            <Link to={to} {...commonProps}>
              {content}
            </Link>
          ) : (
            /* Otherwise, render a standard anchor tag. */
            <a href={href} {...commonProps}>
              {content}
            </a>
          )}
        </NavigationMenuLink>
      </li>
    );
  },
);
ListItem.displayName = 'ListItem';

export function AppBar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- 2. Get the current location from the router ---
  const { pathname } = useLocation();

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-0 sm:pt-2 px-6 sm:px-8 lg:px-8 relative shadow-[var(--shadow-header)]">
        <div className="container flex h-20 md:h-26 items-center justify-between mx-auto">
          <div className="flex items-center justify-start gap-16">
            <Logo />
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  {/* --- 3. THE CORRECT IMPLEMENTATION --- */}
                  <NavigationMenuLink asChild active={pathname === '/bounties'}>
                    <Link
                      to="/bounties"
                      className={cn(navigationMenuTriggerStyle(), 'text-base')}>
                      App Bounties
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  {/* --- 3. THE CORRECT IMPLEMENTATION --- */}
                  <NavigationMenuLink
                    asChild
                    active={pathname === '/audit-hub'}>
                    <Link
                      to="/audit-hub"
                      className={cn(navigationMenuTriggerStyle(), 'text-base')}>
                      Audit Hub
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  {/* --- 3. THE CORRECT IMPLEMENTATION --- */}
                  <NavigationMenuLink
                    asChild
                    active={pathname === '/leaderboard'}>
                    <Link
                      to="/leaderboard"
                      className={cn(navigationMenuTriggerStyle(), 'text-base')}>
                      Leaderboard
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="hidden md:flex justify-end flex-1 px-8">
            <div className="w-full max-w-sm">
              <SearchInput
                className="border border-gray-400 rounded-md"
                placeholder="Search for MCP servers..."
              />
            </div>
          </div>
          <div className="flex items-center justify-end space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSearchOpen(true)}>
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>
            <LoginButton />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-primary" />
      </header>

      {/* Mobile overlays remain the same, as they already use <Link> */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden">
          <div className="border-b bg-background">
            <div className="container mx-auto flex h-20 items-center gap-4 px-4">
              <SearchInput
                ref={searchInputRef}
                placeholder="Search for MCP servers..."
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close search</span>
              </Button>
            </div>
          </div>
        </div>
      )}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden">
          <div className="fixed right-0 top-0 h-full w-full max-w-xs bg-background p-6">
            <div className="flex items-center justify-between mb-8">
              <Logo />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>
            <nav className="flex flex-col space-y-4">
              <Link
                to="/"
                className="text-lg font-medium"
                onClick={() => setIsMobileMenuOpen(false)}>
                Discover Apps
              </Link>
              <Link
                to="/bounties"
                className="text-lg font-medium"
                onClick={() => setIsMobileMenuOpen(false)}>
                App Bounties
              </Link>
              <Link
                to="/audit-hub"
                className="text-lg font-medium"
                onClick={() => setIsMobileMenuOpen(false)}>
                Audit Hub
              </Link>
              <Link
                to="/leaderboard"
                className="text-lg font-medium"
                onClick={() => setIsMobileMenuOpen(false)}>
                Leaderboard
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
