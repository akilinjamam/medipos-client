import Dexie, { type EntityTable } from 'dexie';
import type { Batch, OfflineSaleBody, Product } from '@/types/api';

/**
 * Offline store for the POS terminal (TASKS §Phase 2, spec §9).
 *
 * - `products` / `batches`: READ-ONLY catalog cache, refreshed from the server
 *   on login and periodically. Inventory edits are not allowed offline.
 * - `saleQueue`: sales captured while offline, each with a client-generated
 *   `clientUuid`, POSTed to /api/v1/sales/bulk-sync on reconnect (idempotent).
 * - `meta`: bookkeeping such as last catalog sync time.
 *
 * Catalog rows store the full server document; its `id` (the server maps
 * `_id` -> `id`) is the Dexie primary key, so reads are usable directly as
 * `Product` / `Batch`.
 */
export type CachedProduct = Product & { id: string };
export type CachedBatch = Batch & { id: string };

export type QueuedSaleStatus = 'pending' | 'synced' | 'flagged';

/** Display snapshot of a sold line — product names aren't on the server Sale. */
export interface QueuedLine {
  name: string;
  batchNo: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface QueuedSale {
  clientUuid: string;
  status: QueuedSaleStatus;
  /** Epoch ms; also the sale's captured time (mirrored in `payload.createdAt`). */
  createdAt: number;
  /** Exact body sent to `/sales/bulk-sync` for this sale. */
  payload: OfflineSaleBody;
  totalAmount: number;
  /** Line snapshots for the queue UI + receipt reprint. */
  lines: QueuedLine[];
  /** Set after sync: server sale id (synced) or the conflict reason (flagged). */
  saleId?: string;
  reason?: string;
  syncedAt?: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export const db = new Dexie('medipos') as Dexie & {
  products: EntityTable<CachedProduct, 'id'>;
  batches: EntityTable<CachedBatch, 'id'>;
  saleQueue: EntityTable<QueuedSale, 'clientUuid'>;
  meta: EntityTable<MetaEntry, 'key'>;
};

db.version(1).stores({
  products: 'id, name, barcode',
  batches: 'id, productId, expiryDate',
  saleQueue: 'clientUuid, status, createdAt',
  meta: 'key',
});
