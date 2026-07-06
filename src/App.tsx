import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  clearSessionCache,
  loadSessionCache,
  selectMaintenanceActive,
  selectMaintenanceMessage,
  sessionRestored,
  setInitializing,
} from '@/features/auth/authSlice';
import { authApi } from '@/features/auth/authApi';
import { isNetworkError } from '@/lib/apiError';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { MaintenanceScreen } from '@/components/MaintenanceScreen';

// Route-level code splitting: the heavy POS screen (cart, offline, sales, PDF/
// print, etc.) loads as its own chunk, separate from the login/boot path.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const PosPage = lazy(() => import('@/pages/PosPage'));

export default function App() {
  const dispatch = useAppDispatch();
  const maintenanceActive = useAppSelector(selectMaintenanceActive);
  const maintenanceMessage = useAppSelector(selectMaintenanceMessage);

  // Boot: try the httpOnly refresh cookie to revive a session, then hydrate the
  // user from /auth/me. Either step failing just means "show login". Flip
  // `initializing` off at the end so the route guard can resolve.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dispatch(authApi.endpoints.refresh.initiate()).unwrap();
        await dispatch(authApi.endpoints.getMe.initiate()).unwrap();
      } catch (err) {
        // Can't reach the server (offline / server's DB down): restore the
        // cached non-secret session so the POS can keep billing from the local
        // catalog — the 401→refresh flow re-authenticates on reconnect. A real
        // auth rejection (HTTP response) clears the snapshot → login route.
        const cache = isNetworkError(err) ? loadSessionCache() : null;
        if (cache && !cancelled) dispatch(sessionRestored(cache));
        else if (!isNetworkError(err)) clearSessionCache();
      } finally {
        if (!cancelled) dispatch(setInitializing(false));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Platform maintenance takes over the whole POS (queued offline sales stay
  // safe in IndexedDB and sync after service is restored).
  if (maintenanceActive) return <MaintenanceScreen message={maintenanceMessage} />;

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<PosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster richColors position="top-center" />
    </BrowserRouter>
  );
}
