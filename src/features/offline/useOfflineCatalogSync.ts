import { useCallback, useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { apiErrorMessage } from '@/lib/apiError';
import { getLastSync } from '@/db/catalog';
import { syncCatalog } from '@/features/offline/syncCatalog';
import {
  catalogSyncFailed,
  catalogSyncStarted,
  catalogSyncSucceeded,
  setLastSyncedAt,
} from '@/features/offline/offlineSlice';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

interface Options {
  branchId?: string;
  /** Only sync when the tenant's plan includes offline mode (Gold+). */
  enabled: boolean;
}

/**
 * Keeps the IndexedDB catalog cache fresh for offline billing (spec §9.1):
 * syncs on mount/login, again whenever connectivity returns, and on a periodic
 * timer. No-op for Silver tenants (offline disabled) or until a branch is known.
 * Returns a `resync` callback for a manual "sync now".
 */
export function useOfflineCatalogSync({ branchId, enabled }: Options): {
  resync: () => void;
} {
  const dispatch = useAppDispatch();
  const online = useOnlineStatus();

  // Seed the last-sync time from IndexedDB so the UI can show it pre-sync.
  useEffect(() => {
    let cancelled = false;
    getLastSync().then((ts) => {
      if (!cancelled && ts) dispatch(setLastSyncedAt(ts));
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const run = useCallback(async () => {
    if (!enabled || !online || !branchId) return;
    dispatch(catalogSyncStarted());
    try {
      const r = await syncCatalog(dispatch, branchId);
      dispatch(
        catalogSyncSucceeded({
          productCount: r.products,
          batchCount: r.batches,
          syncedAt: r.syncedAt,
        }),
      );
    } catch (err) {
      dispatch(catalogSyncFailed(apiErrorMessage(err, 'Catalog sync failed')));
    }
  }, [enabled, online, branchId, dispatch]);

  // Sync on mount/enable and whenever connectivity returns (run identity
  // changes with `online`, re-firing this effect on reconnect).
  useEffect(() => {
    void run();
  }, [run]);

  // Periodic refresh while enabled and online.
  useEffect(() => {
    if (!enabled || !online) return;
    const id = setInterval(() => void run(), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [enabled, online, run]);

  return { resync: () => void run() };
}
