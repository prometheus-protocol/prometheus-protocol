import { Outlet } from 'react-router-dom';

export function OAuthLayout() {
  return (
    <main className="text-foreground min-h-screen flex items-center justify-center p-4">
      {/* --- Main Content --- */}
      <Outlet />
    </main>
  );
}
