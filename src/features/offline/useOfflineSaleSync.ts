import { useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { useBulkSyncMutation } from '@/features/sales/salesApi';
import { getPendingSales, markFlagged, markSynced } from '@/db/saleQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

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
  const [bulkSync] = useBulkSyncMutation();
  const running = useRef(false);

  const pending = useLiveQuery(() => (enabled ? getPendingSales() : []), [enabled]);
  const pendingCount = pending?.length ?? 0;

  const flush = useCallback(async () => {
    if (!enabled || !online || running.current) return;
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
      // Network/server hiccup — keep them pending and retry on the next trigger.
    } finally {
      running.current = false;
    }
  }, [enabled, online, bulkSync]);

  // Flush on reconnect and whenever the pending count rises (e.g. a new capture
  // once already online, or leftover queue on boot).
  useEffect(() => {
    if (online && pendingCount > 0) void flush();
  }, [online, pendingCount, flush]);

  return { pendingCount, flush: () => void flush() };
}
