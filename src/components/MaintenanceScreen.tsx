import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyrightLine } from '@/lib/company';

const STATUS_URL = `${import.meta.env.VITE_API_URL}/api/v1/platform/status`;
const POLL_MS = 30_000;

/**
 * Full-screen maintenance takeover (rendered by App instead of the router when
 * the API 503s with MAINTENANCE_MODE). Polls the public /platform/status
 * endpoint — exempt from the maintenance guard — and hard-reloads once the
 * platform is back. Queued offline sales are untouched; they sync after the
 * reload like any reconnect.
 */
export function MaintenanceScreen({ message }: { message?: string }) {
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const res = await fetch(STATUS_URL);
      const body = (await res.json()) as { data?: { maintenance?: boolean } };
      if (res.ok && body.data?.maintenance === false) {
        window.location.reload();
        return;
      }
    } catch {
      // Server unreachable — still down (or we're offline); keep waiting.
    }
    if (manual) setChecking(false);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void check(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [check]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/15">
        <Wrench className="h-10 w-10 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold">We&apos;ll be right back</h1>
        <p className="text-muted-foreground">
          {message || 'MediPOS is under maintenance. We will be back shortly.'}
        </p>
        <p className="text-sm text-muted-foreground">
          This screen checks automatically every 30 seconds and reloads when service is restored.
        </p>
      </div>
      <Button variant="outline" disabled={checking} onClick={() => void check(true)}>
        {checking ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-1 h-4 w-4" />
        )}
        Check again
      </Button>
      <p className="text-xs text-muted-foreground/70">{copyrightLine()}</p>
    </div>
  );
}
