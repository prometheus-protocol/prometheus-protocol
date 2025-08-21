import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import ConsentPage from './pages/ConsentPage';
import NotFoundPage from './pages/NotFoundPage';
import { Toaster } from './components/ui/sonner';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import ConnectionsPage from './pages/ConnectionsPage';
import ConnectionDetailsPage from './pages/ConnectionDetailsPage';

console.log('process.env:', process.env);
console.log('process.env.DFX_NETWORK:', process.env.DFX_NETWORK);
console.log(
  'process.env.CANISTER_ID_MCP_REGISTRY:',
  process.env.CANISTER_ID_MCP_REGISTRY,
);
console.log(
  'process.env.CANISTER_ID_AUTH_SERVER:',
  process.env.CANISTER_ID_AUTH_SERVER,
);
console.log('process.env.II_URL:', process.env.II_URL);

function App() {
  return (
    <BrowserRouter>
      <main className="dark bg-background text-foreground min-h-screen flex items-center justify-center p-4">
        <Routes>
          {/* The main user authorization flow routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/consent" element={<ConsentPage />} />

          {/* --- Protected Routes for Logged-in Users --- */}
          {/* The root path will now be the user's connection dashboard. */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ConnectionsPage />
              </ProtectedRoute>
            }
          />
          {/* The details page for a specific connection, also protected. */}
          <Route
            path="/connections/:id"
            element={
              <ProtectedRoute>
                <ConnectionDetailsPage />
              </ProtectedRoute>
            }
          />

          {/* A catch-all for any undefined routes */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </main>
    </BrowserRouter>
  );
}

export default App;
