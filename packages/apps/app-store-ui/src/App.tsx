import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';

// Layouts
import { MainLayout } from '@/components/layout/MainLayout';

// Auth Components
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Page Components (New Structure)
import HomePage from '@/pages/HomePage'; // The main browsing page
import ServerDetailsPage from '@/pages/ServerDetailsPage'; // Details of one MCP server
import NotFoundPage from '@/pages/NotFoundPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InternetIdentityProvider } from 'ic-use-internet-identity';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
    mutations: {
      retry: false,
    },
  },
});

function App() {
  return (
    // AuthProvider will wrap the entire app to provide auth context
    // This will manage the Internet Identity client and user state.
    <InternetIdentityProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* --- Public Routes using the Main Layout --- */}
            {/* All public-facing pages will share a common layout (e.g., Header, Footer) */}
            <Route element={<MainLayout />}>
              {/* The root path is now the main browsing page for the App Store */}
              <Route path="/" element={<HomePage />} />

              {/* The details page for a specific MCP server, accessible by a slug or ID */}
              <Route path="/server/:serverId" element={<ServerDetailsPage />} />

              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* --- Protected Routes for Logged-in Developers --- */}
            {/* These routes are for developers managing their submissions. */}
            {/* They also use the MainLayout for a consistent look and feel. */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
              {/* Add more protected routes here, e.g., managing a specific submission */}
              {/* <Route path="/dashboard/server/:id/manage" element={<ManageSubmissionPage />} /> */}
            </Route>

            {/* A catch-all for any undefined routes */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </InternetIdentityProvider>
  );
}

export default App;
