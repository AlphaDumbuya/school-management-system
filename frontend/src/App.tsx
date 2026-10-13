import React, { useEffect, useRef } from 'react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useAuthStore from '@store/authStore';
import AppRouter from '@router/routes';
import '@styles/index.css';
import { OfflineIndicator } from '@components/pwa/OfflineIndicator';
import { useLiveSync } from '@hooks/useLiveSync';

// Singleton queryClient — but we call .clear() on logout to purge cross-tenant cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Expose so authStore logout can clear it without a circular import
export function clearQueryCache() {
  queryClient.clear();
}

export const App: React.FC = () => {
  const { initialize, isInitialized, isAuthenticated } = useAuthStore();
  const prevAuthRef = useRef(isAuthenticated);

  // Initialize auth on app load
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Near-real-time refresh: poll the school's change counter while visible and
  // refetch + re-check the user when it moves (promotions, new year, roles…).
  useLiveSync(queryClient, isAuthenticated);

  // Keep the current user's role/identity fresh WITHOUT a re-login, so changes
  // an admin makes (e.g. promoting a teacher to principal, or a student being
  // promoted to a new class) reflect in this session promptly:
  //  - refresh when the window/tab regains focus, and
  //  - refresh on a light interval while the app is open.
  // refreshUser only purges caches when the ROLE actually changed, so this is
  // cheap and non-disruptive.
  useEffect(() => {
    if (!isAuthenticated) return;
    const refresh = () => { useAuthStore.getState().refreshUser(); };
    const onFocus = () => refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(refresh, 2 * 60 * 1000); // every 2 minutes
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [isAuthenticated]);

  // Once auth has initialized the first real screen (login or dashboard) is
  // about to render — tell the branded splash (index.html) it can fade out.
  // This makes the flow feel like one continuous splash → screen with no
  // intermediate spinner/white flash.
  useEffect(() => {
    if (isInitialized) {
      // Defer to the next frame so the real screen paints before the splash lifts.
      requestAnimationFrame(() => window.dispatchEvent(new Event('wiskul:app-ready')));
    }
  }, [isInitialized]);

  // Clear React Query cache the moment a user logs out so the
  // next login never sees stale data from the previous tenant.
  useEffect(() => {
    const wasAuth = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;
    if (wasAuth && !isAuthenticated) {
      queryClient.clear();
    }
  }, [isAuthenticated]);

  // While auth initializes, render nothing — the branded animated splash
  // (in index.html) stays on screen and covers this gap, so users never see a
  // separate spinner or a white flash between the splash and the first screen.
  if (!isInitialized) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineIndicator />
      <AppRouter />
      {/* draggable={false}: disables swipe-to-dismiss, which avoids react-toastify's
          "Unable to preventDefault inside passive event listener" console warning
          on touch devices (the native app). Toasts still auto-dismiss + close button. */}
      <ToastContainer position="top-right" limit={3} autoClose={3500} pauseOnFocusLoss={false} closeButton={true} draggable={false} aria-live="polite" style={{ zIndex: 2147483647 }} />
    </QueryClientProvider>
  );
};

export default App;
