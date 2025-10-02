import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useInternetIdentity } from 'ic-use-internet-identity';
import { LoginButton } from '../LoginButton';
import { Logo } from '../Logo';
import { Search, X, Menu } from 'lucide-react';
import { Button } from '../ui/button';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useSearchQuery } from '@/hooks/useSearch';
import { cn } from '@/lib/utils';
import React from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { DialogTrigger } from '@radix-ui/react-dialog';

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
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { pathname } = useLocation();
  const { identity } = useInternetIdentity();

  const { data: searchResults, isLoading: isSearchLoading } =
    useSearchQuery(searchQuery);

  const handleSelectResult = (namespace: string) => {
    navigate(`/app/${namespace}`); // Navigate to the app detail page
    setIsPopoverOpen(false); // Close the desktop popover
    setIsSearchOpen(false); // Close the mobile search overlay
    setSearchQuery(''); // Clear the search input
  };

  // Effect to open the popover when the user starts typing
  useEffect(() => {
    // Only open the DESKTOP popover if the user is typing AND the MOBILE dialog is closed.
    if (searchQuery.trim().length > 0 && !isSearchOpen) {
      setIsPopoverOpen(true);
    } else {
      setIsPopoverOpen(false);
    }
  }, [searchQuery, isSearchOpen]);

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

  // --- FIX #1: The SearchResults component should NOT have its own <Command> wrapper ---
  // It should only render the list, assuming it will be placed inside a parent Command.
  const SearchResults = () => (
    <CommandList className="border-t-0">
      {isSearchLoading && <CommandEmpty>Searching for apps...</CommandEmpty>}
      {!isSearchLoading &&
        searchResults?.length === 0 &&
        searchQuery.trim() && <CommandEmpty>No results found.</CommandEmpty>}
      {searchResults && searchResults.length > 0 && (
        <CommandGroup heading="Applications">
          {searchResults.map((app) => (
            <CommandItem
              key={app.namespace}
              value={app.namespace}
              onSelect={() => handleSelectResult(app.namespace)}>
              <img
                src={app.icon_url}
                className="h-6 w-6 mr-3 rounded-sm"
                alt=""
              />
              <div className="flex flex-col">
                <span className="font-medium">{app.name}</span>
                <span className="text-xs text-muted-foreground">
                  {app.publisher}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandList>
  );

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

                {/* Wallet link - only show for logged-in users */}
                {identity && (
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild active={pathname === '/wallet'}>
                      <Link
                        to="/wallet"
                        className={cn(
                          navigationMenuTriggerStyle(),
                          'text-base',
                        )}>
                        Wallet
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                )}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          <div className="hidden md:flex justify-end flex-1 px-8">
            <div className="w-full max-w-sm">
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Command>
                    <CommandInput
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                      placeholder="Search for on-chain apps..."
                      className="rounded-md"
                    />
                  </Command>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[24rem] p-0"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}>
                  {/* --- FIX #2: The PopoverContent now provides the Command wrapper --- */}
                  <Command shouldFilter={false}>
                    <SearchResults />
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 sm:space-x-4">
            <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Search className="h-5 w-5" />
                  <span className="sr-only">Search</span>
                </Button>
              </DialogTrigger>
              {/* --- 3. THE DIALOG CONTENT HOLDS THE ENTIRE MOBILE SEARCH UI --- */}
              <DialogContent className="p-1 gap-0 top-0 translate-y-0 h-screen max-h-screen border-none max-w-full">
                <Command shouldFilter={false} className="h-full">
                  <div className="flex items-center border-b-1 pr-3">
                    <CommandInput
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                      placeholder="Search for on-chain apps..."
                      className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div className="overflow-y-auto">
                    <SearchResults />
                  </div>
                </Command>
              </DialogContent>
            </Dialog>

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

      {/* --- CORRECTED MOBILE SEARCH OVERLAY --- */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 rounded bg-background/80 backdrop-blur-sm md:hidden">
          <div className="container mx-auto flex h-20 items-center gap-4 px-4">
            {/* The Command component now structures the entire mobile search view */}
            <Command className="flex-1" shouldFilter={false}>
              <CommandInput
                ref={searchInputRef}
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search for on-chain apps..."
              />
              {/* The results list is part of the command and positioned below the input */}
              <div className="absolute top-20 left-0 right-0 bg-background border-t max-h-[70vh] overflow-y-auto">
                <SearchResults />
              </div>
            </Command>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchOpen(false)}>
              <X className="h-5 w-5" />
              <span className="sr-only">Close search</span>
            </Button>
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
                Home
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
              {identity && (
                <Link
                  to="/wallet"
                  className="text-lg font-medium"
                  onClick={() => setIsMobileMenuOpen(false)}>
                  Wallet
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
