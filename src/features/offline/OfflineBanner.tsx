import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAppSelector } from '@/store/hooks';
import { selectFeatures } from '@/features/auth/authSlice';
import { selectOffline } from '@/features/offline/offlineSlice';
import { cn } from '@/lib/utils';

/**
 * Connectivity banner shown while offline. For offline-capable (Gold+) tenants
 * it confirms billing continues from the cached catalog; otherwise it warns the
 * POS needs a connection. Reference data is read-only offline (spec §9.5).
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const features = useAppSelector(selectFeatures);
  const { lastSyncedAt } = useAppSelector(selectOffline);

  const offlineCapable = features.offlineMode && lastSyncedAt != null;

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn(
            'flex items-center justify-center gap-2 overflow-hidden px-4 py-2 text-center text-sm font-medium',
            offlineCapable ? 'bg-amber-500/15 text-amber-700' : 'bg-destructive/15 text-destructive',
          )}
        >
          <WifiOff className="size-4 shrink-0" />
          {offlineCapable ? (
            <span>
              You’re offline — selling from the cached catalog. Inventory edits are disabled;
              sales sync when you reconnect.
            </span>
          ) : features.offlineMode ? (
            <span>You’re offline and the catalog hasn’t been cached yet. Reconnect to sell.</span>
          ) : (
            <span>You’re offline. Your plan requires a connection to use the POS.</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
