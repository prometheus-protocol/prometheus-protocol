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
import { ScrollToTop } from './components/ScrollToTop';
import { CertificatePage } from './pages/CertificatePage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { FaqPage } from './pages/FaqPage';
import { CommunityPage } from './pages/CommunityPage';

import { configure as configureIcJs } from '@prometheus-protocol/ic-js';
import AppBountiesPage from './pages/AppBountiesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import AuditHubPage from './pages/AuditHubPage';
import AuditDetailsPage from './pages/AuditDetailsPage';
import TokenDemoPage from './pages/TokenDemoPage';
import WalletPage from './pages/WalletPage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import ConsentPage from './pages/ConsentPage';
import ConnectionsPage from './pages/ConnectionsPage';
import { OAuthLayout } from './components/layout/OAuthLayout';

// --- CONFIGURE THE SHARED PACKAGE ---
// This object is created at BUILD TIME. Vite replaces each `process.env`
// access with a static string.
const canisterIds = {
  MCP_REGISTRY: process.env.CANISTER_ID_MCP_REGISTRY!,
  MCP_ORCHESTRATOR: process.env.CANISTER_ID_MCP_ORCHESTRATOR!,
  AUTH_SERVER: process.env.CANISTER_ID_AUTH_SERVER!,
  AUDIT_HUB: process.env.CANISTER_ID_AUDIT_HUB!,
  APP_BOUNTIES: process.env.CANISTER_ID_APP_BOUNTIES!,
  LEADERBOARD: process.env.CANISTER_ID_LEADERBOARD!,
  USDC_LEDGER: process.env.CANISTER_ID_USDC_LEDGER!,
  SEARCH_INDEX: process.env.CANISTER_ID_SEARCH_INDEX!,
  USAGE_TRACKER: process.env.CANISTER_ID_USAGE_TRACKER!,
  // ... add all other canister IDs your app needs
};

const network = process.env.DFX_NETWORK || 'local'; // 'ic' for mainnet, 'local' for local dev
const host = network === 'ic' ? 'https://icp-api.io' : 'http://127.0.0.1:4943';
// Pass the static, build-time configuration to the shared library.
configureIcJs({ canisterIds, host });
// ------------------------------------

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
    <InternetIdentityProvider
      loginOptions={{
        maxTimeToLive: 1_000_000_000n * 60n * 60n * 24n * 7n * 30n,
      }}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* OAuth flow routes */}
            <Route path="/oauth" element={<OAuthLayout />}>
              <Route path="login" element={<LoginPage />} />
              <Route path="setup" element={<SetupPage />} />
              <Route path="consent" element={<ConsentPage />} />
            </Route>
            {/* --- Public Routes using the Main Layout --- */}
            {/* All public-facing pages will share a common layout (e.g., Header, Footer) */}
            <Route element={<MainLayout />}>
              {/* The root path is now the main browsing page for the App Store */}
              <Route path="/" element={<HomePage />} />

              {/* The details page for a specific MCP server, accessible by a slug or ID */}
              <Route path="/app/:appId" element={<ServerDetailsPage />} />
              <Route
                path="/app/:appId/:wasmId"
                element={<ServerDetailsPage />}
              />
              <Route path="/certificate/:appId" element={<CertificatePage />} />
              <Route
                path="/certificate/:appId/:wasmId"
                element={<CertificatePage />}
              />
              {/* Audit Hub Routes */}
              <Route path="audit-hub">
                <Route index element={<AuditHubPage />} />
                <Route path=":auditId" element={<AuditDetailsPage />} />
              </Route>

              {/* Main pages */}
              <Route path="bounties" element={<AppBountiesPage />} />
              <Route path="leaderboard" element={<LeaderboardPage />} />
              <Route path="wallet" element={<WalletPage />} />

              {/* Static informational pages */}
              <Route path="about" element={<AboutPage />} />

              {/* Resources */}
              <Route path="contact" element={<ContactPage />} />
              <Route path="faq" element={<FaqPage />} />
              <Route path="community" element={<CommunityPage />} />

              {/* Legal pages */}
              <Route path="terms" element={<TermsOfServicePage />} />
              <Route path="privacy" element={<PrivacyPolicyPage />} />
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
              <Route path="connections" element={<ConnectionsPage />} />
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
