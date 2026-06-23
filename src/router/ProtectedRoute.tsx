import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';

/**
 * Gates terminal routes behind an authenticated session. While the boot-time
 * refresh is in flight we render nothing to avoid a login flicker.
 */
export function ProtectedRoute() {
  const { user, initializing } = useAppSelector((s) => s.auth);

  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
