import { CloudCheck, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { selectOffline } from '@/features/offline/offlineSlice';
import { timeAgo } from '@/lib/datetime';
import { cn } from '@/lib/utils';

/**
 * Small header indicator of the offline catalog cache state (Gold+). Shows the
 * sync status and how long ago the catalog was last cached; clicking triggers a
 * manual re-sync.
 */
export function OfflineSyncStatus({ onResync }: { onResync: () => void }) {
  const { status, lastSyncedAt, productCount, error } = useAppSelector(selectOffline);
  const label =
    status === 'syncing'
      ? 'Syncing catalog…'
      : status === 'error'
        ? error || 'Sync failed'
        : lastSyncedAt
          ? `Offline ready · ${timeAgo(lastSyncedAt)}`
          : 'Not yet cached';

  const Icon =
    status === 'syncing'
      ? Loader2
      : status === 'error'
        ? CloudOff
        : lastSyncedAt
          ? CloudCheck
          : CloudOff;

  return (
    <button
      type="button"
      onClick={onResync}
      disabled={status === 'syncing'}
      title={
        status === 'synced' && productCount
          ? `${productCount} products cached for offline billing`
          : 'Sync catalog for offline billing'
      }
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
        status === 'error'
          ? 'bg-destructive/10 text-destructive'
          : status === 'synced' || lastSyncedAt
            ? 'bg-sky-500/10 text-sky-600'
            : 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className={cn('size-3.5', status === 'syncing' && 'animate-spin')} />
      {label}
      {status !== 'syncing' && (
        <RefreshCw className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />
      )}
    </button>
  );
}
