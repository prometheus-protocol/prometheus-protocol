import { Outlet } from 'react-router-dom';
import { Footer } from './Footer';
import { AppBar } from './AppBar';

export function MainLayout() {
  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      {/* --- Header --- */}
      <AppBar />

      {/* --- Main Content --- */}
      {/* The Outlet component from React Router will render the active page component here */}
      <main className="flex-1 px-6 sm:px-8 lg:px-16 ">
        <div className="container mx-auto ">
          <Outlet />
        </div>
      </main>

      {/* --- Footer --- */}
      <Footer />
    </div>
  );
}
