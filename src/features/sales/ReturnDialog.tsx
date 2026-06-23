import { useState } from 'react';
import { Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateReturnMutation } from '@/features/sales/salesApi';
import { apiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Sale } from '@/types/api';

interface ReturnDialogProps {
  open: boolean;
  sale: Sale;
  onClose: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Process a return/refund against a sale (owner/manager). Lists the still-
 * returnable lines (qty − returnedQty), lets the manager pick quantities, and
 * previews the refund (line net with the discount prorated to the returned
 * qty — mirrors the server). The server restocks + reverses due/cash.
 */
export function ReturnDialog({ open, sale, onClose }: ReturnDialogProps) {
  // Only lines with un-returned units can be returned.
  const returnable = sale.items.filter((it) => it.qty - it.returnedQty > 0);

  // Returned qty per batchId (defaults to 0).
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [createReturn, { isLoading }] = useCreateReturnMutation();

  const setQty = (batchId: string, qty: number, max: number) =>
    setQtys((prev) => ({ ...prev, [batchId]: Math.max(0, Math.min(qty, max)) }));

  const refund = returnable.reduce((sum, it) => {
    const q = qtys[it.batchId] ?? 0;
    if (q <= 0) return sum;
    const proratedDiscount = round2(it.discount * (q / it.qty));
    return sum + (q * it.unitPrice - proratedDiscount);
  }, 0);

  const items = returnable
    .map((it) => ({ batchId: it.batchId, qty: qtys[it.batchId] ?? 0 }))
    .filter((i) => i.qty > 0);

  async function handleSubmit() {
    if (items.length === 0) {
      toast.error('Select at least one item to return.');
      return;
    }
    try {
      const ret = await createReturn({
        saleId: sale._id,
        body: { items, reason: reason.trim() || undefined },
      }).unwrap();
      toast.success(`Return processed — refund ${formatCurrency(ret.refundAmount)}`, {
        description:
          ret.dueReversed > 0
            ? `${formatCurrency(ret.dueReversed)} off due · ${formatCurrency(ret.cashRefunded)} cash`
            : undefined,
      });
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not process the return.'));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Process return"
      description="Restocks the returned batches and refunds against due first, then cash."
    >
      {returnable.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Everything on this sale has already been returned.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            {returnable.map((it) => {
              const max = it.qty - it.returnedQty;
              const q = qtys[it.batchId] ?? 0;
              return (
                <div
                  key={it.batchId}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
                    q > 0 && 'border-primary bg-accent',
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">Batch {it.batchNo}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(it.unitPrice)} ea · {max} returnable
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(it.batchId, q - 1, max)}
                      disabled={q <= 0}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-7 text-center text-sm font-medium tabular-nums">{q}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(it.batchId, q + 1, max)}
                      disabled={q >= max}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason (optional)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong item, damaged, customer changed mind"
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Refund</span>
            <span className="text-base font-semibold tabular-nums">
              {formatCurrency(round2(refund))}
            </span>
          </div>

          <Button onClick={handleSubmit} disabled={isLoading || items.length === 0}>
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Process return
          </Button>
        </div>
      )}
    </Modal>
  );
}
