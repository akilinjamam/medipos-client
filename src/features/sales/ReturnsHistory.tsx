import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useListReturnsQuery } from '@/features/sales/salesApi';
import { apiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/currency';
import { formatDateTime } from '@/lib/datetime';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { SaleReturn } from '@/types/api';

const PAGE_SIZE = 20;

interface ReturnsHistoryProps {
  open: boolean;
  onClose: () => void;
  branchId?: string;
}

/**
 * Returns/refunds history (TASKS §Phase 2). Paginated, newest-first list of
 * processed returns; each row carries its own line items + refund split, so no
 * per-return detail fetch is needed. Manager/owner, online only.
 */
export function ReturnsHistory({ open, onClose, branchId }: ReturnsHistoryProps) {
  const [page, setPage] = useState(1);
  const { data, isFetching, isError, error } = useListReturnsQuery(
    { branchId, page, limit: PAGE_SIZE },
    { skip: !open },
  );

  const returns = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Returns history"
      description="Processed refunds, newest first."
    >
      {isFetching ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-destructive">{apiErrorMessage(error)}</p>
      ) : returns.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No returns yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {returns.map((r) => (
              <ReturnRow key={r._id} ret={r} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
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
                onClick={() => setPage((p) => p + 1)}
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

function ReturnRow({ ret }: { ret: SaleReturn }) {
  const itemCount = ret.items.reduce((n, i) => n + i.qty, 0);
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <RotateCcw className="size-3.5 text-amber-600" />
            {formatDateTime(ret.createdAt)}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{itemCount} items</span>
            {ret.dueReversed > 0 && (
              <Badge variant="secondary">Due −{formatCurrency(ret.dueReversed)}</Badge>
            )}
            {ret.cashRefunded > 0 && (
              <Badge variant="secondary">Cash {formatCurrency(ret.cashRefunded)}</Badge>
            )}
          </div>
        </div>
        <span className="shrink-0 font-semibold tabular-nums text-amber-600">
          {formatCurrency(ret.refundAmount)}
        </span>
      </div>

      <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
        {ret.items.map((it, i) => (
          <li key={`${it.batchNo}-${i}`} className="truncate">
            Batch {it.batchNo} · {it.qty} × {formatCurrency(it.unitPrice)}
          </li>
        ))}
      </ul>

      {ret.reason && (
        <p className="mt-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {ret.reason}
        </p>
      )}
    </div>
  );
}
