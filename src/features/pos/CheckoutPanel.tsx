import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, Pill, Receipt, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  clearCart,
  attachCustomer,
  detachCustomer,
  selectCartCustomer,
  selectCartLines,
  selectCartTotal,
} from '@/features/cart/cartSlice';
import { selectBranding, selectFeatures } from '@/features/auth/authSlice';
import { receiptBranding } from '@/features/tenants/branding';
import { selectOffline } from '@/features/offline/offlineSlice';
import { useCreateSaleMutation } from '@/features/sales/salesApi';
import { CustomerPicker } from '@/features/customers/CustomerPicker';
import { PrescriptionHistory } from '@/features/customers/PrescriptionHistory';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { enqueueSale } from '@/db/saleQueue';
import { apiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/currency';
import { printReceipt, type ReceiptData } from '@/lib/printReceipt';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import type { CreateSaleBody, OfflineSaleBody, PaymentMethod } from '@/types/api';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'card', label: 'Card' },
  { value: 'due', label: 'Due' },
];

/**
 * Checkout: totals, customer attach, payment method/amount and finalize. On a
 * 409 (a batch depleted under concurrency) the server message is surfaced and
 * the cart is kept so the cashier can re-pick.
 */
export function CheckoutPanel({ branchId }: { branchId?: string }) {
  const dispatch = useAppDispatch();
  const online = useOnlineStatus();
  const lines = useAppSelector(selectCartLines);
  const total = useAppSelector(selectCartTotal);
  const customer = useAppSelector(selectCartCustomer);
  const cashierName = useAppSelector((s) => s.auth.user?.name);
  const features = useAppSelector(selectFeatures);
  const branding = useAppSelector(selectBranding);
  const { lastSyncedAt } = useAppSelector(selectOffline);

  // Offline billing is allowed only for Gold+ tenants that have a cached catalog.
  const offlineReady = features.offlineMode && lastSyncedAt != null;

  const [method, setMethod] = useState<PaymentMethod>('cash');
  // null → use the default (full total, or 0 for a pure "due" sale).
  const [paidInput, setPaidInput] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Bumped on each open so CustomerPicker remounts with fresh internal state.
  const [pickerKey, setPickerKey] = useState(0);
  const [rxOpen, setRxOpen] = useState(false);

  const [createSale, { isLoading }] = useCreateSaleMutation();

  const defaultPaid = method === 'due' ? 0 : total;
  const paid = paidInput !== null ? Number(paidInput) || 0 : defaultPaid;
  const due = Math.max(0, total - paid);

  const empty = lines.length === 0;
  const needsCustomer = due > 0 && !customer;
  const overpaid = paid > total;

  function print(receipt: ReceiptData) {
    if (!printReceipt(receipt)) {
      toast.error('Allow pop-ups to print the receipt.');
    }
  }

  // Receipt is built from the cart (line items keep product names here; the
  // server Sale stores only batchNo). `method` is the current payment method.
  function buildReceipt(opts: {
    invoiceNo: string;
    dateIso: string;
    paidAmount: number;
    dueAmount: number;
  }): ReceiptData {
    return {
      ...receiptBranding(branding, features.whiteLabeling),
      cashierName,
      customerName: customer?.name,
      invoiceNo: opts.invoiceNo,
      dateIso: opts.dateIso,
      lines: lines.map((l) => ({
        name: l.productName,
        batchNo: l.batchNo,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
      })),
      totalAmount: total,
      paidAmount: opts.paidAmount,
      dueAmount: opts.dueAmount,
      paymentMethod: METHODS.find((m) => m.value === method)?.label ?? method,
    };
  }

  function resetAfterSale() {
    dispatch(clearCart());
    setPaidInput(null);
    setMethod('cash');
  }

  // Offline capture (§9.2): queue the sale with a client UUID + decrement the
  // local cache; the background sync flushes it to /sales/bulk-sync on reconnect.
  async function captureOffline() {
    if (!offlineReady) {
      toast.error('Offline billing isn’t ready — catalog not cached.');
      return;
    }
    if (due > 0) {
      toast.error('Due sales need a connection — collect full payment offline.');
      return;
    }

    const clientUuid = uuidv4();
    const createdAt = new Date().toISOString();
    const payload: OfflineSaleBody = {
      branchId: branchId!,
      customerId: customer?.id,
      paymentMethod: method,
      paidAmount: paid,
      items: lines.map((l) => ({
        productId: l.productId,
        batchId: l.batchId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
      })),
      clientUuid,
      createdAt,
    };
    const receipt = buildReceipt({
      invoiceNo: clientUuid,
      dateIso: createdAt,
      paidAmount: paid,
      dueAmount: 0,
    });

    try {
      await enqueueSale({
        clientUuid,
        status: 'pending',
        createdAt: Date.now(),
        payload,
        totalAmount: total,
        lines: receipt.lines,
      });
    } catch {
      toast.error('Could not queue the sale offline.');
      return;
    }

    resetAfterSale();
    toast.success(`Sale queued offline — ${formatCurrency(total)}`, {
      description: 'Will sync automatically when you reconnect.',
      action: { label: 'Print receipt', onClick: () => print(receipt) },
    });
  }

  async function handleFinalize() {
    if (empty || !branchId) return;
    if (overpaid) {
      toast.error('Paid amount exceeds the total.');
      return;
    }
    if (!online) {
      await captureOffline();
      return;
    }
    if (needsCustomer) {
      toast.error('Attach a customer for a sale with a due amount.');
      return;
    }

    const body: CreateSaleBody = {
      branchId,
      customerId: customer?.id,
      paymentMethod: method,
      paidAmount: paid,
      items: lines.map((l) => ({
        productId: l.productId,
        batchId: l.batchId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
      })),
    };

    try {
      const sale = await createSale(body).unwrap();
      const receipt = buildReceipt({
        invoiceNo: sale.id,
        dateIso: sale.createdAt,
        paidAmount: sale.paidAmount,
        dueAmount: sale.dueAmount,
      });
      resetAfterSale();
      toast.success(`Sale completed — ${formatCurrency(sale.totalAmount)}`, {
        action: { label: 'Print receipt', onClick: () => print(receipt) },
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not finalize the sale.'));
    }
  }

  function openCustomerPicker() {
    // Customer search/create hits the server — unavailable offline (§9.5).
    if (!online) {
      toast.error('Attaching a customer needs a connection.');
      return;
    }
    setPickerKey((k) => k + 1);
    setPickerOpen(true);
  }

  function newSale() {
    dispatch(clearCart());
    setPaidInput(null);
    setMethod('cash');
  }

  // Counter shortcuts (suppressed while a modal owns the keyboard):
  // F4 attach customer · F8 finalize · F9 new sale. F2 (focus search) lives in
  // ProductSearch.
  useHotkeys({
    F4: openCustomerPicker,
    F8: () => void handleFinalize(),
    F9: newSale,
  });

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      {/* Customer */}
      {customer ? (
        <div className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5">
            <UserRound className="size-4" />
            {customer.name}
          </span>
          <div className="flex items-center gap-1">
            {features.prescriptionHistory && online && (
              <button
                type="button"
                onClick={() => setRxOpen(true)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                title="Prescription history"
              >
                <Pill className="size-3.5" />
                Rx
              </button>
            )}
            <button
              type="button"
              onClick={() => dispatch(detachCustomer())}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Detach customer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={openCustomerPicker}
          disabled={!online}
          title={online ? undefined : 'Unavailable offline'}
        >
          <UserRound className="size-4" />
          Attach customer
          <Kbd className="ml-auto">F4</Kbd>
        </Button>
      )}

      {/* Payment method */}
      <div className="grid grid-cols-5 gap-1">
        {METHODS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              setMethod(m.value);
              setPaidInput(null);
            }}
            className={cn(
              'rounded-md border px-1 py-1.5 text-xs font-medium transition-colors',
              method === m.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Paid amount */}
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="paid-amount" className="text-sm text-muted-foreground">
          Paid
        </label>
        <input
          id="paid-amount"
          type="number"
          min={0}
          value={paidInput ?? String(defaultPaid)}
          onChange={(e) => setPaidInput(e.target.value)}
          className={cn(
            'h-9 w-32 rounded-md border bg-background px-2 text-right text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            overpaid && 'border-destructive',
          )}
        />
      </div>

      {/* Totals */}
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
        </div>
        {due > 0 && (
          <div className="flex justify-between text-amber-600">
            <span>Due</span>
            <span className="font-semibold tabular-nums">{formatCurrency(due)}</span>
          </div>
        )}
      </div>

      {needsCustomer && (
        <p className="text-xs text-amber-600">
          A customer is required to record the due amount.
        </p>
      )}

      {!online && (
        <p className="text-xs text-amber-600">
          {offlineReady
            ? 'Offline — full-payment sales are queued and sync when you reconnect.'
            : 'Offline — the POS needs a connection to sell on this plan.'}
        </p>
      )}

      {!empty && (
        <Button variant="outline" size="sm" onClick={newSale}>
          <Trash2 className="size-4" />
          New sale
          <Kbd className="ml-auto">F9</Kbd>
        </Button>
      )}

      <Button
        size="lg"
        className="h-12 text-base"
        disabled={
          empty || isLoading || !branchId || overpaid || (!online && !offlineReady)
        }
        onClick={() => void handleFinalize()}
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Receipt className="size-5" />
        )}
        {!online && offlineReady ? 'Queue' : 'Finalize'} {!empty && formatCurrency(total)}
        <Kbd className="border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">
          F8
        </Kbd>
      </Button>

      <p className="text-center text-[11px] text-muted-foreground">
        <Kbd>F2</Kbd> search · <Kbd>F4</Kbd> customer · <Kbd>F8</Kbd> pay · <Kbd>F9</Kbd>{' '}
        new
      </p>

      <CustomerPicker
        key={pickerKey}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(c) => dispatch(attachCustomer({ id: c.id, name: c.name }))}
      />

      {customer && (
        <PrescriptionHistory
          open={rxOpen}
          customerId={customer.id}
          customerName={customer.name}
          onClose={() => setRxOpen(false)}
        />
      )}
    </div>
  );
}
