import { useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { useBulkSyncMutation } from '@/features/sales/salesApi';
import { getPendingSales, markFlagged, markSynced } from '@/db/saleQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAppSelector } from '@/store/hooks';
import { selectSubscriptionExpired } from '@/features/auth/authSlice';

interface Options {
  /** Only flush for offline-capable (Gold+) tenants. */
  enabled: boolean;
}

/**
 * Background flush of the offline sale queue (spec §9.3–9.4). Whenever we're
 * online and pending sales exist, POST them to `/sales/bulk-sync` (idempotent
 * via clientUuid) and reconcile each result: synced/duplicate → marked synced,
 * conflict (depleted batch) → flagged for manual review (never silently
 * oversold). A failed flush leaves sales pending for the next attempt.
 */
export function useOfflineSaleSync({ enabled }: Options): {
  pendingCount: number;
  flush: () => void;
} {
  const online = useOnlineStatus();
  // While the tenant is 402-blocked, retrying is pointless — the queue stays
  // pending and the effect below re-flushes as soon as the block lifts.
  const blocked = useAppSelector(selectSubscriptionExpired);
  const [bulkSync] = useBulkSyncMutation();
  const running = useRef(false);

  const pending = useLiveQuery(() => (enabled ? getPendingSales() : []), [enabled]);
  const pendingCount = pending?.length ?? 0;

  const flush = useCallback(async () => {
    if (!enabled || !online || blocked || running.current) return;
    const sales = await getPendingSales();
    if (sales.length === 0) return;

    running.current = true;
    try {
      const results = await bulkSync(sales.map((s) => s.payload)).unwrap();
      for (const r of results) {
        if (r.status === 'conflict') {
          await markFlagged(r.clientUuid, r.reason);
        } else {
          await markSynced(r.clientUuid, r.saleId);
        }
      }
      const conflicts = results.filter((r) => r.status === 'conflict').length;
      const ok = results.length - conflicts;
      if (ok > 0) toast.success(`Synced ${ok} offline sale${ok > 1 ? 's' : ''}.`);
      if (conflicts > 0) {
        toast.warning(
          `${conflicts} offline sale${conflicts > 1 ? 's' : ''} need review (stock conflict).`,
        );
      }
    } catch {
      // Network/server hiccup or 402 — keep them pending. On a 402 the
      // baseQuery intercept has already raised subscriptionExpired, which
      // gates re-entry until renewal.
    } finally {
      running.current = false;
    }
  }, [enabled, online, blocked, bulkSync]);

  // Flush on reconnect, whenever the pending count rises (e.g. a new capture
  // once already online, or leftover queue on boot), and when a subscription
  // block lifts after renewal.
  useEffect(() => {
    if (online && !blocked && pendingCount > 0) void flush();
  }, [online, blocked, pendingCount, flush]);

  return { pendingCount, flush: () => void flush() };
}
