import { useEffect, useRef, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { Shell } from '@/components/layout/Shell';
import { AccessGate } from '@/components/layout/AccessGate';
import Home from '@/pages/home';
import History from '@/pages/history';
import Settings from '@/pages/settings';
import Admin from '@/pages/admin';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import { LanguageProvider } from '@/lib/i18n';

const queryClient = new QueryClient();

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function HomeGate() {
  return (
    <>
      <Show when="signed-in">
        <Shell>
          <Home />
        </Shell>
      </Show>
      <Show when="signed-out">
        <AccessGate />
      </Show>
    </>
  );
}

function ProtectedPage({ component: Component }: { component: () => ReactElement }) {
  return (
    <>
      <Show when="signed-in">
        <Shell>
          <Component />
        </Shell>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <TooltipProvider>
            <ClerkQueryClientCacheInvalidator />
            <Switch>
              <Route path="/" component={HomeGate} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/history">
                <ProtectedPage component={History} />
              </Route>
              <Route path="/settings">
                <ProtectedPage component={Settings} />
              </Route>
              <Route path="/admin">
                <ProtectedPage component={Admin} />
              </Route>
              <Route component={NotFound} />
            </Switch>
            <Toaster />
          </TooltipProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
