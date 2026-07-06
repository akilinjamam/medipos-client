import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

/** 402 error code emitted by the server's subscription-enforcement middleware. */
export const SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED';

/** 503 error code emitted while the platform maintenance switch is on. */
export const MAINTENANCE_MODE = 'MAINTENANCE_MODE';

/** Server errors are shaped `{ error: { message, code, details } }` (errorHandler.ts). */
interface ServerErrorBody {
  error?: { message?: string; code?: string; details?: unknown };
}

function asFbqError(err: unknown): FetchBaseQueryError | null {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    return err as FetchBaseQueryError;
  }
  return null;
}

/** Pull a human-readable message out of an RTK Query error. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const fbq = asFbqError(err);
  if (fbq) {
    if (fbq.status === 'FETCH_ERROR') return 'Cannot reach the server. Check your connection.';
    const body = fbq.data as ServerErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
  }
  return fallback;
}

/** Numeric HTTP status, or undefined for transport errors (FETCH_ERROR etc.). */
export function apiErrorStatus(err: unknown): number | undefined {
  const fbq = asFbqError(err);
  return fbq && typeof fbq.status === 'number' ? fbq.status : undefined;
}

/**
 * True for transport-level failures — offline, DNS, or a hung server hitting
 * the fetch timeout. Distinguishes "can't reach the server" from a real HTTP
 * rejection (401 etc.), which matters for offline session restore.
 */
export function isNetworkError(err: unknown): boolean {
  const fbq = asFbqError(err);
  return fbq?.status === 'FETCH_ERROR' || fbq?.status === 'TIMEOUT_ERROR';
}

/** Machine-readable `error.code` from the server envelope (e.g. SUBSCRIPTION_EXPIRED). */
export function apiErrorCode(err: unknown): string | undefined {
  const fbq = asFbqError(err);
  const body = fbq?.data as ServerErrorBody | undefined;
  return typeof body?.error?.code === 'string' ? body.error.code : undefined;
}
