import { LoginButton } from '../LoginButton';
import { Logo } from '../Logo';
import { SearchInput } from '../SearchInput';

export function AppBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-0 sm:pt-2 px-6 sm:px-8 lg:px-8 relative shadow-[var(--shadow-header)]">
      <div className="container flex h-20 md:h-26 items-center mx-auto">
        <div className="mr-4 flex">
          <Logo className="mr-6" />
        </div>
        {/* --- Center Section: Search Bar (expands to fill space) --- */}
        <div className="flex-1 flex justify-center px-4">
          <div className="w-full max-w-md">
            <SearchInput placeholder="Search for MCP servers..." />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <LoginButton />
        </div>
      </div>
      <div
        className="
          absolute bottom-0 left-0 w-full h-px 
          bg-yellow-400/50
        "
      />
    </header>
  );
}
