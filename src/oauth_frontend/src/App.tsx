import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import ConsentPage from './pages/ConsentPage';
import DashboardPage from './pages/DashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import { Toaster } from './components/ui/sonner';

function App() {
  return (
    <BrowserRouter>
      <main className="dark bg-background text-foreground min-h-screen flex items-center justify-center p-4">
        <Routes>
          {/* The main user authorization flow routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/consent" element={<ConsentPage />} />

          {/* The user's account management dashboard */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* A catch-all for any undefined routes */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </main>
    </BrowserRouter>
  );
}

export default App;
