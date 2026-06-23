import { formatCurrency } from './currency';
import { formatDateTime } from './datetime';

export interface ReceiptLine {
  name: string;
  batchNo: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface ReceiptData {
  businessName: string;
  /** White-label header extras. */
  logoUrl?: string;
  addressLine?: string;
  phone?: string;
  cashierName?: string;
  customerName?: string;
  invoiceNo: string;
  dateIso: string;
  lines: ReceiptLine[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  /** Display label for the payment method, e.g. "Cash". */
  paymentMethod: string;
  footer?: string;
  /** Thermal roll width in millimetres. */
  widthMm?: 58 | 80;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function buildHtml(data: ReceiptData, width: number): string {
  const lineRows = data.lines
    .map((l) => {
      const lineTotal = Math.max(0, l.qty * l.unitPrice - l.discount);
      const discRow =
        l.discount > 0
          ? `<div class="muted">  discount −${esc(formatCurrency(l.discount))}</div>`
          : '';
      return `
        <div class="item">
          <div class="name">${esc(l.name)}</div>
          <div class="muted">batch ${esc(l.batchNo)}</div>
          <div class="row">
            <span>${l.qty} × ${esc(formatCurrency(l.unitPrice))}</span>
            <span>${esc(formatCurrency(lineTotal))}</span>
          </div>
          ${discRow}
        </div>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${esc(data.invoiceNo)}</title>
  <style>
    @page { size: ${width}mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      width: ${width - 4}mm;
      font-family: 'Courier New', ui-monospace, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
    }
    .center { text-align: center; }
    .logo { max-width: 60%; max-height: 80px; margin: 0 auto 4px; display: block; }
    .biz { font-size: 14px; font-weight: 700; }
    .muted { color: #000; opacity: 0.75; font-size: 10px; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .item { margin: 3px 0; }
    .item .name { font-weight: 600; word-break: break-word; }
    hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .totals .row { font-size: 11px; }
    .totals .grand { font-weight: 700; font-size: 12px; }
  </style>
</head>
<body>
  <div class="center">
    ${data.logoUrl ? `<img class="logo" src="${esc(data.logoUrl)}" alt="" />` : ''}
    <div class="biz">${esc(data.businessName)}</div>
    ${data.addressLine ? `<div class="muted">${esc(data.addressLine)}</div>` : ''}
    ${data.phone ? `<div class="muted">${esc(data.phone)}</div>` : ''}
  </div>
  <hr />
  <div class="muted">No: ${esc(data.invoiceNo)}</div>
  <div class="muted">${esc(formatDateTime(data.dateIso))}</div>
  ${data.cashierName ? `<div class="muted">Cashier: ${esc(data.cashierName)}</div>` : ''}
  ${data.customerName ? `<div class="muted">Customer: ${esc(data.customerName)}</div>` : ''}
  <hr />
  ${lineRows}
  <hr />
  <div class="totals">
    <div class="row grand"><span>Total</span><span>${esc(formatCurrency(data.totalAmount))}</span></div>
    <div class="row"><span>Paid (${esc(data.paymentMethod)})</span><span>${esc(formatCurrency(data.paidAmount))}</span></div>
    ${data.dueAmount > 0 ? `<div class="row"><span>Due</span><span>${esc(formatCurrency(data.dueAmount))}</span></div>` : ''}
  </div>
  <hr />
  <div class="center muted">${data.footer ? esc(data.footer) : 'Thank you!'}</div>
</body>
</html>`;
}

/**
 * Print a thermal-friendly HTML receipt by writing a self-contained document
 * into a popup window and invoking the browser print dialog. Fully offline (no
 * network), and sized via `@page` for 58mm/80mm rolls. Returns `false` if the
 * popup was blocked so the caller can surface a hint.
 */
export function printReceipt(data: ReceiptData): boolean {
  const width = data.widthMm ?? 80;
  const win = window.open('', 'medipos-receipt', 'width=380,height=600');
  if (!win) return false;

  win.document.open();
  win.document.write(buildHtml(data, width));
  win.document.close();
  win.focus();

  // Close the popup once printing is done; print after a tick so layout settles.
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 250);
  return true;
}
