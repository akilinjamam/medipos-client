/** BDT money formatting for the counter (Bangladesh market). */

const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a number as Bangladeshi Taka, e.g. `৳1,250.00`. */
export function formatCurrency(amount: number): string {
  return `৳${amountFormat.format(amount)}`;
}
