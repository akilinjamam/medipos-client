import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetSaleQuery,
  useLazyGetInvoiceQuery,
  useListSalesQuery,
} from '@/features/sales/salesApi';
import { ReturnDialog } from '@/features/sales/ReturnDialog';
import { selectIsManager } from '@/features/auth/authSlice';
import { useAppSelector } from '@/store/hooks';
import { apiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/currency';
import { formatDateTime } from '@/lib/datetime';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PaymentMethod, ReturnStatus, Sale } from '@/types/api';

const PAGE_SIZE = 20;

interface RecentSalesProps {
  open: boolean;
  onClose: () => void;
  branchId?: string;
}

const methodLabel: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bkash: 'bKash',
  nagad: 'Nagad',
  card: 'Card',
  due: 'Due',
};

function ReturnBadge({ status }: { status: ReturnStatus }) {
  if (status === 'none') return null;
  return (
    <Badge variant="warning">
      <RotateCcw className="size-3" />
      {status === 'full' ? 'Returned' : 'Partial return'}
    </Badge>
  );
}

/** Reusable invoice opener — opens the S3 PDF; local-disk has no public URL. */
function useOpenInvoice() {
  const [fetchInvoice] = useLazyGetInvoiceQuery();
  return async (saleId: string) => {
    try {
      const stored = await fetchInvoice(saleId).unwrap();
      if (stored.storage === 's3' && /^https?:/.test(stored.url)) {
        window.open(stored.url, '_blank', 'noopener');
      } else {
        toast.info('Invoice generated on the server (local storage — no public URL).');
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not generate the invoice.'));
    }
  };
}

/**
 * Recent sales browser (TASKS §Phase 1). A paginated list (newest first) that
 * drills into a single sale's line items, with an invoice reprint. Line items
 * are shown receipt-style by batch; the PDF invoice carries full product names.
 */
export function RecentSales({ open, onClose, branchId }: RecentSalesProps) {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <SaleDetail
        open={open}
        saleId={selectedId}
        onBack={() => setSelectedId(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <SalesList
      open={open}
      onClose={onClose}
      branchId={branchId}
      page={page}
      onPage={setPage}
      onSelect={setSelectedId}
    />
  );
}

function SalesList({
  open,
  onClose,
  branchId,
  page,
  onPage,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  branchId?: string;
  page: number;
  onPage: (p: number) => void;
  onSelect: (id: string) => void;
}) {
  const { data, isFetching, isError, error } = useListSalesQuery(
    { branchId, page, limit: PAGE_SIZE },
    { skip: !open },
  );

  const sales = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recent sales"
      description="Newest first. Select a sale to view its items and reprint the invoice."
    >
      {isFetching ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-destructive">{apiErrorMessage(error)}</p>
      ) : sales.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {sales.map((s) => (
              <SaleRow key={s._id} sale={s} onSelect={() => onSelect(s._id)} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPage(page - 1)}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => onPage(page + 1)}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function SaleRow({ sale, onSelect }: { sale: Sale; onSelect: () => void }) {
  const itemCount = sale.items.reduce((n, i) => n + i.qty, 0);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{formatDateTime(sale.createdAt)}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{itemCount} items</span>
          <Badge variant="secondary">{methodLabel[sale.paymentMethod]}</Badge>
          {sale.dueAmount > 0 && (
            <Badge variant="warning">Due {formatCurrency(sale.dueAmount)}</Badge>
          )}
          <ReturnBadge status={sale.returnStatus} />
          {sale.syncedFromOffline && <Badge variant="outline">Offline</Badge>}
        </div>
      </div>
      <span className="shrink-0 font-semibold tabular-nums">
        {formatCurrency(sale.totalAmount)}
      </span>
    </button>
  );
}

function SaleDetail({
  open,
  saleId,
  onBack,
  onClose,
}: {
  open: boolean;
  saleId: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const { data: sale, isFetching, isError, error } = useGetSaleQuery(saleId, { skip: !open });
  const openInvoice = useOpenInvoice();
  const isManager = useAppSelector(selectIsManager);
  const [invoicing, setInvoicing] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const canReturn =
    isManager && !!sale && sale.items.some((it) => it.qty - it.returnedQty > 0);

  async function handleInvoice() {
    setInvoicing(true);
    await openInvoice(saleId);
    setInvoicing(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sale detail"
      description={sale ? formatDateTime(sale.createdAt) : undefined}
    >
      {isFetching ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError || !sale ? (
        <p className="py-6 text-center text-sm text-destructive">{apiErrorMessage(error)}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="secondary">{methodLabel[sale.paymentMethod]}</Badge>
            <ReturnBadge status={sale.returnStatus} />
            {sale.syncedFromOffline && <Badge variant="outline">Offline</Badge>}
          </div>

          <div className="flex flex-col gap-1">
            {sale.items.map((it, idx) => {
              const lineTotal = Math.max(0, it.qty * it.unitPrice - it.discount);
              return (
                <div
                  key={`${it.batchId}-${idx}`}
                  className="flex items-center justify-between gap-3 border-b py-1.5 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate">
                      Batch {it.batchNo}
                      {it.returnedQty > 0 && (
                        <span className="ml-1 text-xs text-amber-600">
                          ({it.returnedQty} returned)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {it.qty} × {formatCurrency(it.unitPrice)}
                      {it.discount > 0 && ` − ${formatCurrency(it.discount)}`}
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums">{formatCurrency(lineTotal)}</span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1 border-t pt-3 text-sm">
            <Row label="Total" value={formatCurrency(sale.totalAmount)} bold />
            <Row label="Paid" value={formatCurrency(sale.paidAmount)} />
            {sale.dueAmount > 0 && (
              <Row label="Due" value={formatCurrency(sale.dueAmount)} amber />
            )}
            {sale.refundedAmount > 0 && (
              <Row label="Refunded" value={formatCurrency(sale.refundedAmount)} amber />
            )}
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={onBack}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <div className="flex gap-2">
              {canReturn && (
                <Button variant="outline" onClick={() => setReturnOpen(true)}>
                  <RotateCcw className="size-4" />
                  Return
                </Button>
              )}
              <Button onClick={handleInvoice} disabled={invoicing}>
                {invoicing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Receipt className="size-4" />
                )}
                Invoice
              </Button>
            </div>
          </div>

          <ReturnDialog open={returnOpen} sale={sale} onClose={() => setReturnOpen(false)} />
        </div>
      )}
    </Modal>
  );
}

function Row({
  label,
  value,
  bold,
  amber,
}: {
  label: string;
  value: string;
  bold?: boolean;
  amber?: boolean;
}) {
  return (
    <div className={`flex justify-between ${amber ? 'text-amber-600' : ''}`}>
      <span className={amber ? '' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}
