import { toast } from 'sonner';
import type { StoredObject } from '@/types/api';

/**
 * Result of the invoice-PDF endpoint. The server (`utils/pdfDelivery.ts`)
 * returns one of two shapes:
 *  - JSON `{ data: StoredObject }` when S3 is configured (a retrievable URL), or
 *  - the raw PDF bytes when S3 is not configured.
 * `invoicePdfResponseHandler` normalises both into this union. Unlike the
 * dashboard's export flow, the POS is print-only — the bytes are never offered
 * as a download.
 */
export type InvoicePdfResult =
  | { kind: 'stored'; stored: StoredObject }
  | { kind: 'bytes'; objectUrl: string };

/**
 * RTK Query `responseHandler` for the invoice endpoint. Detects whether the
 * response is the stored-URL JSON or streamed PDF bytes. For bytes it creates
 * an object-URL **string** (not a Blob) so nothing non-serialisable lands in
 * the Redux store.
 */
export async function invoicePdfResponseHandler(response: Response): Promise<unknown> {
  // Let RTK Query's error path parse the normal error body.
  if (!response.ok) return response.json();

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/pdf')) {
    const blob = await response.blob();
    return { kind: 'bytes', objectUrl: URL.createObjectURL(blob) } satisfies InvoicePdfResult;
  }

  const body = (await response.json()) as { data: StoredObject };
  return { kind: 'stored', stored: body.data } satisfies InvoicePdfResult;
}

/**
 * Print an `InvoicePdfResult`. Streamed bytes print directly from a hidden
 * iframe; a stored S3 URL is fetched into a blob first (cross-origin iframes
 * can't be printed) and falls back to opening the URL in a new tab if the
 * fetch is blocked.
 */
export async function printInvoicePdf(result: InvoicePdfResult): Promise<void> {
  if (result.kind === 'bytes') {
    printObjectUrl(result.objectUrl);
    return;
  }
  if (/^https?:\/\//i.test(result.stored.url)) {
    try {
      const response = await fetch(result.stored.url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      printObjectUrl(URL.createObjectURL(await response.blob()));
    } catch {
      window.open(result.stored.url, '_blank', 'noopener,noreferrer');
    }
    return;
  }
  // Local-disk StoredObject (file:// path) — nothing the browser can print.
  toast.info('Invoice generated on the server (local storage — no public URL).');
}

/** Load a same-origin PDF object URL into a hidden iframe and print it. */
function printObjectUrl(objectUrl: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = objectUrl;
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
  document.body.appendChild(iframe);
  // The frame (and its object URL) must outlive the print dialog; print() does
  // not block in all browsers, so clean up on a generous timer instead.
  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(objectUrl);
  }, 60_000);
}
