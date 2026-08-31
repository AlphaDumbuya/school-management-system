import React, { useEffect, useRef } from 'react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useAuthStore from '@store/authStore';
import AppRouter from '@router/routes';
import '@styles/index.css';
import { InstallBanner } from '@components/pwa/InstallBanner';

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

  // Clear React Query cache the moment a user logs out so the
  // next login never sees stale data from the previous tenant.
  useEffect(() => {
    const wasAuth = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;
    if (wasAuth && !isAuthenticated) {
      queryClient.clear();
    }
  }, [isAuthenticated]);

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <ToastContainer position="top-right" closeButton={true} aria-live="polite" />
      <InstallBanner />
    </QueryClientProvider>
  );
};

export default App;
