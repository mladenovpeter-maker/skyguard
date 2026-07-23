import { type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/layout/Shell';
import Home from '@/pages/home';
import History from '@/pages/history';
import Settings from '@/pages/settings';
import Admin from '@/pages/admin';
import Spectrum from '@/pages/spectrum';
import LoginPage from '@/pages/login';
import LandingPage from '@/pages/landing';
import { LanguageProvider } from '@/lib/i18n';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@/lib/auth';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Any logged-in user. */
function ProtectedPage({ component: Component }: { component: () => ReactElement }) {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!user) return <Redirect to="/" />;
  return <Shell><Component /></Shell>;
}

/** Admin-only page — redirects operators to /. */
function AdminPage({ component: Component }: { component: () => ReactElement }) {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!user) return <Redirect to="/" />;
  if (user.role !== "admin") return <Redirect to="/" />;
  return <Shell><Component /></Shell>;
}

/** Root: landing page for guests, radar for logged-in users. */
function HomeGate() {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!user) return <LandingPage />;
  return <Shell><Home /></Shell>;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeGate} />
      <Route path="/login" component={LoginPage} />
      <Route path="/history">
        <ProtectedPage component={History} />
      </Route>
      <Route path="/spectrum">
        <ProtectedPage component={Spectrum} />
      </Route>
      <Route path="/settings">
        <AdminPage component={Settings} />
      </Route>
      <Route path="/admin">
        <AdminPage component={Admin} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <WouterRouter base={basePath}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LanguageProvider>
              <TooltipProvider>
                <AppRoutes />
                <Toaster />
              </TooltipProvider>
            </LanguageProvider>
          </AuthProvider>
        </QueryClientProvider>
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
