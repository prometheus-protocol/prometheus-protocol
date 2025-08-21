import { useState, useEffect, useRef } from 'react';
import { LoginButton } from '../LoginButton';
import { Logo } from '../Logo';
import { SearchInput } from '../SearchInput';
import { Search, X } from 'lucide-react';
import { Button } from '../ui/button';

export function AppBar() {
  // --- 1. Add state to manage the mobile search overlay ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Effect to auto-focus the input when the overlay opens
  useEffect(() => {
    if (isSearchOpen) {
      // We use a short timeout to ensure the element is fully rendered and focusable
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-0 sm:pt-2 px-6 sm:px-8 lg:px-8 relative shadow-[var(--shadow-header)]">
        {/* --- 2. Use a 3-column grid for perfect centering --- */}
        <div className="container grid h-20 grid-cols-2 md:grid-cols-3 h-20 md:h-26 items-center justify-between mx-auto">
          {/* --- Left Column: Logo --- */}
          <div className="flex items-center justify-start">
            <Logo className="mr-6" />
          </div>

          {/* --- Center Column: Full Search Bar (Desktop) --- */}
          <div className="hidden md:flex justify-center">
            <div className="w-full max-w-md">
              <SearchInput placeholder="Search for MCP servers..." />
            </div>
          </div>

          {/* --- Right Column: Actions --- */}
          <div className="flex items-center justify-end space-x-2 sm:space-x-4">
            {/* Mobile-only Search Icon Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsSearchOpen(true)} // This now opens the overlay
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Search</span>
            </Button>

            <LoginButton />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-primary" />
      </header>

      {/* --- 3. Mobile Search Overlay --- */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
          data-state={isSearchOpen ? 'open' : 'closed'}>
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
                onClick={() => setIsSearchOpen(false)} // This closes the overlay
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close search</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
