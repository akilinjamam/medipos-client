import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, CloudUpload, ListChecks } from 'lucide-react';
import { countQueue } from '@/db/saleQueue';
import { Badge } from '@/components/ui/badge';

/**
 * Header button summarising the offline sale queue: how many sales wait to sync
 * and how many were flagged for review (stock conflict at sync). Opens the queue
 * management screen. Shown for offline-capable (Gold+) tenants.
 */
export function OfflineQueueStatus({ onClick }: { onClick: () => void }) {
  const counts = useLiveQuery(() => countQueue(), []);
  const pending = counts?.pending ?? 0;
  const flagged = counts?.flagged ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Offline sale queue"
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
    >
      <ListChecks className="size-3.5" />
      <span className="hidden sm:inline">Queue</span>
      {pending > 0 && (
        <Badge variant="warning">
          <CloudUpload className="size-3" />
          {pending}
        </Badge>
      )}
      {flagged > 0 && (
        <Badge variant="destructive">
          <AlertTriangle className="size-3" />
          {flagged}
        </Badge>
      )}
    </button>
  );
}
