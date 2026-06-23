import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import {
  lineTotal,
  removeLine,
  selectCartLines,
  setDiscount,
  setQty,
} from '@/features/cart/cartSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';

/** The cart line list — quantity stepper, per-line discount and removal. */
export function Cart() {
  const dispatch = useAppDispatch();
  const lines = useAppSelector(selectCartLines);

  if (lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
        <ShoppingCart className="size-7" />
        <p className="text-sm">Cart is empty. Search a medicine to start a sale.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
      <AnimatePresence initial={false}>
        {lines.map((line) => (
          <motion.div
            key={line.batchId}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="rounded-md border bg-background p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{line.productName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  Batch {line.batchNo} · {formatCurrency(line.unitPrice)} ea
                </div>
              </div>
              <button
                type="button"
                onClick={() => dispatch(removeLine(line.batchId))}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Remove ${line.productName}`}
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  aria-label="Decrease quantity"
                  onClick={() => dispatch(setQty({ batchId: line.batchId, qty: line.qty - 1 }))}
                >
                  <Minus className="size-3.5" />
                </Button>
                <span
                  className="w-8 text-center text-sm font-medium tabular-nums"
                  aria-label={`Quantity ${line.qty}`}
                >
                  {line.qty}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  aria-label="Increase quantity"
                  disabled={line.qty >= line.maxQty}
                  onClick={() => dispatch(setQty({ batchId: line.batchId, qty: line.qty + 1 }))}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Disc</span>
                <input
                  type="number"
                  min={0}
                  aria-label={`Discount for ${line.productName}`}
                  value={line.discount || ''}
                  placeholder="0"
                  onChange={(e) =>
                    dispatch(
                      setDiscount({
                        batchId: line.batchId,
                        discount: Number(e.target.value) || 0,
                      }),
                    )
                  }
                  className="h-7 w-16 rounded-md border bg-background px-2 text-right text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>

              <span className="w-20 text-right text-sm font-semibold tabular-nums">
                {formatCurrency(lineTotal(line))}
              </span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
