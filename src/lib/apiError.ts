import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

/** Server errors are shaped `{ error: { message, details } }` (errorHandler.ts). */
interface ServerErrorBody {
  error?: { message?: string; details?: unknown };
}

/** Pull a human-readable message out of an RTK Query error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const fbq = err as FetchBaseQueryError;
    if (fbq.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection.';
    const body = fbq.data as ServerErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
  }
  return fallback;
}
