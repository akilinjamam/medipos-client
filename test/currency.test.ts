import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/lib/currency';

describe('formatCurrency', () => {
  it('formats BDT with the ৳ symbol and 2 decimals', () => {
    expect(formatCurrency(1250)).toBe('৳1,250.00');
    expect(formatCurrency(0)).toBe('৳0.00');
    expect(formatCurrency(5.5)).toBe('৳5.50');
  });

  it('groups thousands', () => {
    expect(formatCurrency(1234567.5)).toBe('৳1,234,567.50');
  });
});
