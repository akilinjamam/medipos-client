import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppDispatch } from '@/store/hooks';
import { baseApi } from '@/store/api/baseApi';
import { setSubscriptionExpired } from '@/features/auth/authSlice';
import { useLogoutMutation } from '@/features/auth/authApi';

interface Props {
  /** Queued offline sales awaiting sync (kept safe while blocked). */
  pendingCount: number;
}

/**
 * Full-screen blocker shown when the server 402s with SUBSCRIPTION_EXPIRED.
 * `role="dialog"` is load-bearing: the POS suppresses all global hotkeys and
 * keyboard-wedge handling while a [role=dialog] is open, so F8-finalize and
 * the scanner are dead while blocked.
 */
export function SubscriptionExpiredOverlay({ pendingCount }: Props) {
  const dispatch = useAppDispatch();
  const [logout, { isLoading }] = useLogoutMutation();

  // Exempt endpoints never 402, so "check again" must re-attempt a blocked
  // call: clear the flag and refetch the active catalog queries — if the
  // tenant is still lapsed the baseQuery intercept re-raises the flag within
  // one round trip; if renewed, the POS simply resumes.
  const checkAgain = () => {
    dispatch(setSubscriptionExpired(false));
    dispatch(baseApi.util.invalidateTags(['Product', 'Batch']));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-expired-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6"
    >
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-lg">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <h2 id="subscription-expired-title" className="mb-2 text-lg font-semibold">
          Subscription expired
        </h2>
        <p className="mb-1 text-sm text-muted-foreground">
          Billing is paused. Ask the owner to renew the plan from the admin dashboard.
        </p>
        {pendingCount > 0 && (
          <p className="mb-1 text-sm text-muted-foreground">
            Your {pendingCount} queued offline sale{pendingCount > 1 ? 's are' : ' is'} safe and
            will sync automatically after renewal.
          </p>
        )}
        <div className="mt-5 flex justify-center gap-3">
          <Button onClick={checkAgain}>
            <RefreshCw className="size-4" />
            Check again
          </Button>
          <Button variant="outline" onClick={() => logout()} disabled={isLoading}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
