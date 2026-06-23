import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAppDispatch } from '@/store/hooks';
import { setInitializing } from '@/features/auth/authSlice';
import { authApi } from '@/features/auth/authApi';
import { ProtectedRoute } from '@/router/ProtectedRoute';

// Route-level code splitting: the heavy POS screen (cart, offline, sales, PDF/
// print, etc.) loads as its own chunk, separate from the login/boot path.
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const PosPage = lazy(() => import('@/pages/PosPage'));

export default function App() {
  const dispatch = useAppDispatch();

  // Boot: try the httpOnly refresh cookie to revive a session, then hydrate the
  // user from /auth/me. Either step failing just means "show login". Flip
  // `initializing` off at the end so the route guard can resolve.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dispatch(authApi.endpoints.refresh.initiate()).unwrap();
        await dispatch(authApi.endpoints.getMe.initiate()).unwrap();
      } catch {
        // No valid session — fall through to the login route.
      } finally {
        if (!cancelled) dispatch(setInitializing(false));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

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
