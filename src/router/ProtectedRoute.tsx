import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';

/**
 * Gates terminal routes behind an authenticated session. While the boot-time
 * refresh is in flight we show a loader (not a blank screen) to avoid a login
 * flicker before the session resolves.
 */
export function ProtectedRoute() {
  const { user, initializing } = useAppSelector((s) => s.auth);

  if (initializing) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="flex min-h-screen items-center justify-center"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
