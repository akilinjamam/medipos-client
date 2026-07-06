import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  CloudCheck,
  CloudUpload,
  Printer,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  clearSynced,
  getQueue,
  removeSale,
  retrySale,
} from '@/db/saleQueue';
import type { QueuedSale, QueuedSaleStatus } from '@/db/db';
import { selectBranding, selectFeatures } from '@/features/auth/authSlice';
import { receiptBranding } from '@/features/tenants/branding';
import { useAppSelector } from '@/store/hooks';
import { formatCurrency } from '@/lib/currency';
import { formatDateTime } from '@/lib/datetime';
import { printReceipt } from '@/lib/printReceipt';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PaymentMethod } from '@/types/api';

const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bkash: 'bKash',
  nagad: 'Nagad',
  card: 'Card',
  due: 'Due',
};

type Filter = 'all' | QueuedSaleStatus;

interface SaleQueueProps {
  open: boolean;
  onClose: () => void;
  online: boolean;
  /** Manual flush of pending sales (the background sync's `flush`). */
  onSyncNow: () => void;
}

/**
 * Offline sale queue management (TASKS §Phase 2). Lists captured offline sales
 * by status, lets the manager manually sync pending ones, retry conflicts
 * ("needs review" — a batch was depleted before sync, never silently oversold),
 * reprint receipts, and clear synced entries.
 */
export function SaleQueue({ open, onClose, online, onSyncNow }: SaleQueueProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const branding = useAppSelector(selectBranding);
  const features = useAppSelector(selectFeatures);
  const queue = useLiveQuery(() => (open ? getQueue() : []), [open]) ?? [];

  const counts = {
    all: queue.length,
    pending: queue.filter((q) => q.status === 'pending').length,
    flagged: queue.filter((q) => q.status === 'flagged').length,
    synced: queue.filter((q) => q.status === 'synced').length,
  };
  const rows = filter === 'all' ? queue : queue.filter((q) => q.status === filter);

  async function handleRetry(q: QueuedSale) {
    await retrySale(q.clientUuid);
    if (online) onSyncNow();
    else toast.info('Re-queued — will sync when you reconnect.');
  }

  async function handleRemove(q: QueuedSale) {
    if (!window.confirm('Remove this sale from the queue? This cannot be undone.')) return;
    await removeSale(q.clientUuid);
  }

  function handleReprint(q: QueuedSale) {
    const paid = q.payload.paidAmount ?? q.totalAmount;
    const ok = printReceipt({
      ...receiptBranding(branding, features.whiteLabeling),
      invoiceNo: q.saleId ?? q.clientUuid,
      dateIso: new Date(q.createdAt).toISOString(),
      lines: q.lines,
      totalAmount: q.totalAmount,
      paidAmount: paid,
      dueAmount: Math.max(0, q.totalAmount - paid),
      paymentMethod: methodLabel[q.payload.paymentMethod],
    });
    if (!ok) toast.error('Allow pop-ups to print the receipt.');
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: `All ${counts.all}` },
    { key: 'pending', label: `Pending ${counts.pending}` },
    { key: 'flagged', label: `Review ${counts.flagged}` },
    { key: 'synced', label: `Synced ${counts.synced}` },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Offline sale queue"
      description="Sales captured offline. They sync automatically when you reconnect."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === f.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {counts.synced > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void clearSynced()}>
                Clear synced
              </Button>
            )}
            <Button
              size="sm"
              disabled={!online || counts.pending === 0}
              onClick={onSyncNow}
              title={online ? undefined : 'Reconnect to sync'}
            >
              <RefreshCw className="size-3.5" />
              Sync now
            </Button>
          </div>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {filter === 'all' ? 'The queue is empty.' : `No ${filter} sales.`}
            </p>
          ) : (
            rows.map((q) => (
              <QueueRow
                key={q.clientUuid}
                sale={q}
                onRetry={() => handleRetry(q)}
                onRemove={() => handleRemove(q)}
                onReprint={() => handleReprint(q)}
              />
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

function StatusBadge({ status }: { status: QueuedSaleStatus }) {
  if (status === 'pending')
    return (
      <Badge variant="warning">
        <CloudUpload className="size-3" />
        Pending
      </Badge>
    );
  if (status === 'synced')
    return (
      <Badge variant="success">
        <CloudCheck className="size-3" />
        Synced
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <AlertTriangle className="size-3" />
      Needs review
    </Badge>
  );
}

function QueueRow({
  sale,
  onRetry,
  onRemove,
  onReprint,
}: {
  sale: QueuedSale;
  onRetry: () => void;
  onRemove: () => void;
  onReprint: () => void;
}) {
  const itemCount = sale.lines.reduce((n, l) => n + l.qty, 0);
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{formatDateTime(new Date(sale.createdAt).toISOString())}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <StatusBadge status={sale.status} />
            <span>{itemCount} items</span>
            <Badge variant="secondary">{methodLabel[sale.payload.paymentMethod]}</Badge>
          </div>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">
          {formatCurrency(sale.totalAmount)}
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
        {sale.lines.map((l, i) => (
          <li key={`${l.batchNo}-${i}`} className="truncate">
            {l.name} · {l.qty} × {formatCurrency(l.unitPrice)}
          </li>
        ))}
      </ul>

      {sale.status === 'flagged' && sale.reason && (
        <p className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {sale.reason}
        </p>
      )}

      <div className="mt-2 flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onReprint}>
          <Printer className="size-3.5" />
          Receipt
        </Button>
        {sale.status === 'flagged' && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            Retry
          </Button>
        )}
        {sale.status !== 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
