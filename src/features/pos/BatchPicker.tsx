import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, Loader2, PackageX } from 'lucide-react';
import { useListBatchesQuery } from '@/features/batches/batchesApi';
import { addLine } from '@/features/cart/cartSlice';
import { useAppDispatch } from '@/store/hooks';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCachedBatches } from '@/db/catalog';
import { CrossBranchHint } from '@/features/pos/CrossBranchHint';
import { apiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Batch, Product } from '@/types/api';

interface BatchPickerProps {
  product: Product | null;
  branchId?: string;
  onClose: () => void;
  /** Called after a batch+qty is added to the cart (e.g. to refocus search). */
  onAdded?: () => void;
}

// At or below this on-hand total at the current branch, surface the cross-branch hint.
const LOW_STOCK_HINT = 5;

function daysUntil(dateIso: string): number {
  const ms = new Date(dateIso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Batch / FEFO picker. When a product is chosen on the catalog, this lists its
 * in-stock batches (server returns them first-expiry-first-out) so the cashier
 * can confirm the FEFO default — or override it — then add a quantity to the cart.
 */
export function BatchPicker({ product, branchId, onClose, onAdded }: BatchPickerProps) {
  const dispatch = useAppDispatch();
  const online = useOnlineStatus();
  const open = product !== null;

  // Online: query the server. Offline: read this product's cached batches.
  const {
    data: apiBatches,
    isFetching,
    isError,
    error,
  } = useListBatchesQuery(
    { productId: product?._id, branchId, inStock: true },
    { skip: !open || !branchId || !online },
  );
  const cachedBatches = useLiveQuery(
    () => (open && !online && product ? getCachedBatches(product._id) : undefined),
    [open, online, product],
  );

  // CachedBatch extends Batch, so the cache rows satisfy Batch[] for rendering.
  const batches: Batch[] | undefined = online ? apiBatches : cachedBatches;
  const loading = online ? isFetching : open && !online && cachedBatches === undefined;

  // "Short" at this branch → offer the cross-branch availability hint (online).
  const currentTotal = (batches ?? []).reduce((n, b) => n + b.quantityInStock, 0);
  const short = online && !loading && currentTotal <= LOW_STOCK_HINT;

  // `null` override means "use the FEFO default" (first batch, server-sorted).
  // Derived rather than synced via effect, and reset per-product by a `key` on
  // this component in PosPage.
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  const selectedId = overrideId ?? batches?.[0]?._id ?? null;
  const selected = batches?.find((b) => b._id === selectedId) ?? null;
  const maxQty = selected?.quantityInStock ?? 0;

  function handleAdd() {
    if (!product || !selected) return;
    dispatch(
      addLine({
        productId: product._id,
        productName: product.name,
        batchId: selected._id,
        batchNo: selected.batchNo,
        expiryDate: selected.expiryDate,
        qty,
        unitPrice: selected.sellPrice,
        discount: 0,
        maxQty: selected.quantityInStock,
      }),
    );
    onClose();
    onAdded?.();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? `Add ${product.name}` : 'Add product'}
      description="Pick a batch (first-expiry-first-out by default) and quantity."
    >
      {!branchId ? (
        <p className="py-6 text-center text-sm text-destructive">
          No branch is set for this cashier — a sale needs a branch. Contact your manager.
        </p>
      ) : loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : online && isError ? (
        <p className="py-6 text-center text-sm text-destructive">
          {apiErrorMessage(error)}
        </p>
      ) : !batches || batches.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <PackageX className="size-6" />
          <p className="text-sm">
            {online
              ? 'No in-stock batches for this product at this branch.'
              : 'No cached batches for this product. Reconnect to sync.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {batches.map((b: Batch, idx) => {
              const days = daysUntil(b.expiryDate);
              const isSelected = b._id === selectedId;
              return (
                <button
                  key={b._id}
                  type="button"
                  onClick={() => {
                    setOverrideId(b._id);
                    setQty((q) => Math.min(q, b.quantityInStock) || 1);
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors',
                    isSelected ? 'border-primary bg-accent' : 'hover:bg-accent',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Batch {b.batchNo}</span>
                      {idx === 0 && <Badge variant="secondary">FEFO</Badge>}
                      {days <= 0 ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : days <= 90 ? (
                        <Badge variant="warning">
                          <CalendarClock className="size-3" />
                          {days}d
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Exp {formatDate(b.expiryDate)} · {b.quantityInStock} in stock
                    </div>
                  </div>
                  <span className="ml-3 shrink-0 font-medium">
                    {formatCurrency(b.sellPrice)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-end justify-between gap-4 border-t pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Quantity</label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={!selected}
                >
                  −
                </Button>
                <input
                  type="number"
                  min={1}
                  max={maxQty || undefined}
                  value={qty}
                  aria-label="Quantity"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) {
                      setQty(Math.max(1, Math.min(n, maxQty || n)));
                    }
                  }}
                  className="h-9 w-16 rounded-md border bg-background px-2 text-center text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(maxQty || q + 1, q + 1))}
                  disabled={!selected || qty >= maxQty}
                >
                  +
                </Button>
              </div>
            </div>
            <Button type="button" onClick={handleAdd} disabled={!selected} className="flex-1">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Add {selected ? formatCurrency(selected.sellPrice * qty) : ''}
            </Button>
          </div>
        </div>
      )}

      {branchId && short && product && (
        <CrossBranchHint productId={product._id} currentBranchId={branchId} />
      )}
    </Modal>
  );
}
