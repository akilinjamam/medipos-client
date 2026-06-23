import { describe, it, expect } from 'vitest';
import reducer, {
  addLine,
  setQty,
  setUnitPrice,
  setDiscount,
  removeLine,
  attachCustomer,
  detachCustomer,
  clearCart,
  lineTotal,
  selectCartLines,
  selectCartCustomer,
  selectCartItemCount,
  selectCartTotal,
  type CartLine,
  type CartState,
} from '@/features/cart/cartSlice';
import type { RootState } from '@/store/store';

function makeLine(over: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'p1',
    productName: 'Napa 500mg',
    batchId: 'b1',
    batchNo: 'B-001',
    expiryDate: '2027-01-01',
    qty: 1,
    unitPrice: 10,
    discount: 0,
    maxQty: 5,
    ...over,
  };
}

const initial = (): CartState => reducer(undefined, { type: '@@INIT' });
const asRoot = (cart: CartState) => ({ cart }) as unknown as RootState;

describe('cartSlice reducer', () => {
  it('adds a new line', () => {
    const state = reducer(initial(), addLine(makeLine()));
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].batchId).toBe('b1');
  });

  it('merges quantity when the same batch is added again, capped at maxQty', () => {
    let state = reducer(initial(), addLine(makeLine({ qty: 3 })));
    state = reducer(state, addLine(makeLine({ qty: 3 }))); // 3 + 3 = 6 → capped at 5
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0].qty).toBe(5);
  });

  it('clamps an incoming qty above maxQty', () => {
    const state = reducer(initial(), addLine(makeLine({ qty: 99, maxQty: 4 })));
    expect(state.lines[0].qty).toBe(4);
  });

  it('setQty clamps to [1, maxQty]', () => {
    let state = reducer(initial(), addLine(makeLine({ maxQty: 5 })));
    state = reducer(state, setQty({ batchId: 'b1', qty: 0 }));
    expect(state.lines[0].qty).toBe(1);
    state = reducer(state, setQty({ batchId: 'b1', qty: 50 }));
    expect(state.lines[0].qty).toBe(5);
  });

  it('setUnitPrice / setDiscount floor at 0', () => {
    let state = reducer(initial(), addLine(makeLine()));
    state = reducer(state, setUnitPrice({ batchId: 'b1', unitPrice: -7 }));
    state = reducer(state, setDiscount({ batchId: 'b1', discount: -3 }));
    expect(state.lines[0].unitPrice).toBe(0);
    expect(state.lines[0].discount).toBe(0);
  });

  it('removeLine drops the matching line', () => {
    let state = reducer(initial(), addLine(makeLine()));
    state = reducer(state, addLine(makeLine({ batchId: 'b2', productId: 'p2' })));
    state = reducer(state, removeLine('b1'));
    expect(state.lines.map((l) => l.batchId)).toEqual(['b2']);
  });

  it('attaches and detaches a customer', () => {
    let state = reducer(initial(), attachCustomer({ id: 'c1', name: 'Mr X' }));
    expect(state.customerId).toBe('c1');
    expect(state.customerName).toBe('Mr X');
    state = reducer(state, detachCustomer());
    expect(state.customerId).toBeUndefined();
    expect(state.customerName).toBeUndefined();
  });

  it('clearCart resets to the initial state', () => {
    let state = reducer(initial(), addLine(makeLine()));
    state = reducer(state, attachCustomer({ id: 'c1', name: 'Mr X' }));
    state = reducer(state, clearCart());
    expect(state.lines).toHaveLength(0);
    expect(state.customerId).toBeUndefined();
  });
});

describe('cart totals', () => {
  it('lineTotal = qty*price - discount, floored at 0', () => {
    expect(lineTotal(makeLine({ qty: 3, unitPrice: 10, discount: 5 }))).toBe(25);
    expect(lineTotal(makeLine({ qty: 1, unitPrice: 10, discount: 999 }))).toBe(0);
  });

  it('selectors compute count/total and customer', () => {
    let state = initial();
    state = reducer(state, addLine(makeLine({ batchId: 'b1', qty: 2, unitPrice: 10 })));
    state = reducer(state, addLine(makeLine({ batchId: 'b2', qty: 1, unitPrice: 30, discount: 5, maxQty: 9 })));
    state = reducer(state, attachCustomer({ id: 'c1', name: 'Mr X' }));

    expect(selectCartLines(asRoot(state))).toHaveLength(2);
    expect(selectCartItemCount(asRoot(state))).toBe(3); // 2 + 1
    expect(selectCartTotal(asRoot(state))).toBe(45); // 20 + 25
    expect(selectCartCustomer(asRoot(state))).toEqual({ id: 'c1', name: 'Mr X' });
  });

  it('selectCartCustomer is null with no customer', () => {
    expect(selectCartCustomer(asRoot(initial()))).toBeNull();
  });
});
