import React, { useEffect, useRef } from 'react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useAuthStore from '@store/authStore';
import AppRouter from '@router/routes';
import '@styles/index.css';
import { OfflineIndicator } from '@components/pwa/OfflineIndicator';

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
      <ToastContainer position="top-right" closeButton={true} draggable={false} aria-live="polite" style={{ zIndex: 2147483647 }} />
    </QueryClientProvider>
  );
};

export default App;
