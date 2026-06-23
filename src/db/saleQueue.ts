import { db, type QueuedSale, type QueuedSaleStatus } from '@/db/db';

/**
 * Read/write layer over the offline sale queue (spec §9.2–9.4). Sales captured
 * while offline live here with a client-generated `clientUuid` (making the
 * server bulk-sync idempotent), and are flushed on reconnect.
 */

export interface QueueCounts {
  pending: number;
  synced: number;
  flagged: number;
}

/**
 * Persist a captured offline sale and optimistically decrement the *local*
 * batch cache so subsequent offline sales see reduced stock (UX only — the
 * server re-checks and is the source of truth at sync time).
 */
export async function enqueueSale(entry: QueuedSale): Promise<void> {
  await db.transaction('rw', db.saleQueue, db.batches, async () => {
    await db.saleQueue.add(entry);
    for (const item of entry.payload.items) {
      const batch = await db.batches.get(item.batchId);
      if (batch) {
        await db.batches.update(item.batchId, {
          quantityInStock: Math.max(0, batch.quantityInStock - item.qty),
        });
      }
    }
  });
}

/** All queued sales, newest first (for the queue management screen). */
export async function getQueue(): Promise<QueuedSale[]> {
  return db.saleQueue.orderBy('createdAt').reverse().toArray();
}

export async function getPendingSales(): Promise<QueuedSale[]> {
  return db.saleQueue.where('status').equals('pending').toArray();
}

export async function countQueue(): Promise<QueueCounts> {
  const all = await db.saleQueue.toArray();
  const count = (s: QueuedSaleStatus) => all.filter((q) => q.status === s).length;
  return { pending: count('pending'), synced: count('synced'), flagged: count('flagged') };
}

export async function markSynced(clientUuid: string, saleId?: string): Promise<void> {
  await db.saleQueue.update(clientUuid, {
    status: 'synced',
    saleId,
    syncedAt: Date.now(),
    reason: undefined,
  });
}

export async function markFlagged(clientUuid: string, reason?: string): Promise<void> {
  await db.saleQueue.update(clientUuid, { status: 'flagged', reason });
}

/** Re-queue a flagged sale for another sync attempt (manual review action). */
export async function retrySale(clientUuid: string): Promise<void> {
  await db.saleQueue.update(clientUuid, { status: 'pending', reason: undefined });
}

export async function removeSale(clientUuid: string): Promise<void> {
  await db.saleQueue.delete(clientUuid);
}

/** Drop already-synced entries (housekeeping). */
export async function clearSynced(): Promise<void> {
  await db.saleQueue.where('status').equals('synced').delete();
}
