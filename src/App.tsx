import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAppDispatch } from '@/store/hooks';
import { setInitializing } from '@/features/auth/authSlice';
import { authApi } from '@/features/auth/authApi';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import PosPage from '@/pages/PosPage';

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<PosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </BrowserRouter>
  );
}
