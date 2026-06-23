import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store/store';

/**
 * The current (in-progress) sale at the counter.
 *
 * One cart line maps to one batch — stock is tracked per batch on the server, so
 * a sale line item is `{ productId, batchId, qty, unitPrice, discount }`. Adding
 * the same batch twice just increases its quantity (capped at `maxQty`, the local
 * view of stock-on-hand; the server re-checks atomically at finalize).
 */
export interface CartLine {
  productId: string;
  productName: string;
  batchId: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  unitPrice: number;
  /** Flat discount amount for the whole line (BDT), not a percentage. */
  discount: number;
  /** Quantity on hand for this batch — a soft cap for the qty stepper. */
  maxQty: number;
}

export interface CartState {
  lines: CartLine[];
  customerId?: string;
  customerName?: string;
}

const initialState: CartState = {
  lines: [],
};

function clampQty(qty: number, maxQty: number): number {
  if (qty < 1) return 1;
  if (maxQty > 0 && qty > maxQty) return maxQty;
  return qty;
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addLine(state, action: PayloadAction<CartLine>) {
      const incoming = action.payload;
      const existing = state.lines.find((l) => l.batchId === incoming.batchId);
      if (existing) {
        existing.qty = clampQty(existing.qty + incoming.qty, existing.maxQty);
      } else {
        state.lines.push({ ...incoming, qty: clampQty(incoming.qty, incoming.maxQty) });
      }
    },
    setQty(state, action: PayloadAction<{ batchId: string; qty: number }>) {
      const line = state.lines.find((l) => l.batchId === action.payload.batchId);
      if (line) line.qty = clampQty(action.payload.qty, line.maxQty);
    },
    setUnitPrice(state, action: PayloadAction<{ batchId: string; unitPrice: number }>) {
      const line = state.lines.find((l) => l.batchId === action.payload.batchId);
      if (line) line.unitPrice = Math.max(0, action.payload.unitPrice);
    },
    setDiscount(state, action: PayloadAction<{ batchId: string; discount: number }>) {
      const line = state.lines.find((l) => l.batchId === action.payload.batchId);
      if (line) line.discount = Math.max(0, action.payload.discount);
    },
    removeLine(state, action: PayloadAction<string>) {
      state.lines = state.lines.filter((l) => l.batchId !== action.payload);
    },
    attachCustomer(state, action: PayloadAction<{ id: string; name: string }>) {
      state.customerId = action.payload.id;
      state.customerName = action.payload.name;
    },
    detachCustomer(state) {
      state.customerId = undefined;
      state.customerName = undefined;
    },
    clearCart() {
      return initialState;
    },
  },
});

export const {
  addLine,
  setQty,
  setUnitPrice,
  setDiscount,
  removeLine,
  attachCustomer,
  detachCustomer,
  clearCart,
} = cartSlice.actions;

export default cartSlice.reducer;

/** Net total of a single line (qty × price − discount), floored at 0. */
export function lineTotal(line: CartLine): number {
  return Math.max(0, line.qty * line.unitPrice - line.discount);
}

// --- Selectors ---
export const selectCartLines = (s: RootState) => s.cart.lines;
export const selectCartCustomer = (s: RootState) =>
  s.cart.customerId ? { id: s.cart.customerId, name: s.cart.customerName! } : null;
export const selectCartItemCount = (s: RootState) =>
  s.cart.lines.reduce((n, l) => n + l.qty, 0);
export const selectCartTotal = (s: RootState) =>
  s.cart.lines.reduce((sum, l) => sum + lineTotal(l), 0);
