/** Shared date/time formatting for the counter UI (en-GB, day-first). */

export function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateIso: string): string {
  return new Date(dateIso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Compact relative time from an epoch-ms timestamp, e.g. "just now", "5m ago". */
export function timeAgo(ts: number): string {
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 30) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
