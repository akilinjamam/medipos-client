import { db, type CachedBatch, type CachedProduct } from '@/db/db';
import type { Batch, Product } from '@/types/api';

/**
 * Read/write layer over the IndexedDB catalog cache (Dexie). The cache is the
 * read source for the POS while offline; the server stays the source of truth.
 * Reference data is read-only offline (spec §9.5) — these helpers only ever
 * replace the cache wholesale on sync, never mutate individual rows from the UI.
 */

export const LAST_SYNC_KEY = 'catalog:lastSync';
export const SYNC_BRANCH_KEY = 'catalog:branchId';

/** Atomically replace the cached catalog with a freshly pulled snapshot. */
export async function replaceCatalog(
  products: Product[],
  batches: Batch[],
  branchId: string,
): Promise<void> {
  await db.transaction('rw', db.products, db.batches, db.meta, async () => {
    await db.products.clear();
    await db.batches.clear();
    // `id` is the Dexie primary key and is already on each server document.
    await db.products.bulkPut(products);
    await db.batches.bulkPut(batches);
    await db.meta.bulkPut([
      { key: LAST_SYNC_KEY, value: Date.now() },
      { key: SYNC_BRANCH_KEY, value: branchId },
    ]);
  });
}

/** Epoch ms of the last successful catalog sync, or null if never synced. */
export async function getLastSync(): Promise<number | null> {
  const entry = await db.meta.get(LAST_SYNC_KEY);
  return typeof entry?.value === 'number' ? entry.value : null;
}

/** Branch the cached catalog was synced for (to detect a branch switch). */
export async function getSyncedBranch(): Promise<string | null> {
  const entry = await db.meta.get(SYNC_BRANCH_KEY);
  return typeof entry?.value === 'string' ? entry.value : null;
}

/** Free-text product search over the cache (name / generic / brand / barcode). */
export async function searchCachedProducts(
  term: string,
  limit = 20,
): Promise<CachedProduct[]> {
  const t = term.trim().toLowerCase();
  if (!t) return db.products.limit(limit).toArray();

  const all = await db.products.toArray();
  return all
    .filter((p) =>
      [p.name, p.genericName, p.brand, p.barcode].some((f) =>
        f?.toLowerCase().includes(t),
      ),
    )
    .slice(0, limit);
}

/** Exact barcode lookup against the cache (scanner path while offline). */
export async function getCachedProductByBarcode(
  code: string,
): Promise<CachedProduct | undefined> {
  return db.products.where('barcode').equals(code).first();
}

/** In-stock batches for a product, FEFO-ordered (earliest expiry first). */
export async function getCachedBatches(productId: string): Promise<CachedBatch[]> {
  const rows = await db.batches.where('productId').equals(productId).toArray();
  return rows
    .filter((b) => b.quantityInStock > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export async function getCachedProductCount(): Promise<number> {
  return db.products.count();
}

/** Wipe the cached catalog (e.g. on logout or branch switch before re-sync). */
export async function clearCatalog(): Promise<void> {
  await db.transaction('rw', db.products, db.batches, db.meta, async () => {
    await db.products.clear();
    await db.batches.clear();
    await db.meta.bulkDelete([LAST_SYNC_KEY, SYNC_BRANCH_KEY]);
  });
}
