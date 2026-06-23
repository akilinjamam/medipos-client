import type { AppDispatch } from '@/store/store';
import { productsApi } from '@/features/products/productsApi';
import { batchesApi } from '@/features/batches/batchesApi';
import { replaceCatalog } from '@/db/catalog';
import type { Product } from '@/types/api';

const PAGE_SIZE = 200;

export interface CatalogSyncResult {
  products: number;
  batches: number;
  syncedAt: number;
}

/**
 * Pull the full product catalog (paginated) and the branch's in-stock batches
 * into IndexedDB so the POS can bill offline (spec §9.1). Reuses the RTK Query
 * endpoints (so auth/refresh apply); `forceRefetch` bypasses the cache and each
 * subscription is released immediately since this is a one-shot pull.
 */
export async function syncCatalog(
  dispatch: AppDispatch,
  branchId: string,
): Promise<CatalogSyncResult> {
  const products: Product[] = [];
  let page = 1;
  let total = Infinity;

  while (products.length < total) {
    const sub = dispatch(
      productsApi.endpoints.listProducts.initiate(
        { page, limit: PAGE_SIZE },
        { forceRefetch: true },
      ),
    );
    try {
      const res = await sub.unwrap();
      products.push(...res.data);
      total = res.total;
      if (res.data.length === 0) break; // safety against an off-by-one total
    } finally {
      sub.unsubscribe();
    }
    page += 1;
  }

  const batchSub = dispatch(
    batchesApi.endpoints.listBatches.initiate(
      { branchId, inStock: true },
      { forceRefetch: true },
    ),
  );
  const batches = await batchSub.unwrap().finally(() => batchSub.unsubscribe());

  await replaceCatalog(products, batches, branchId);
  return { products: products.length, batches: batches.length, syncedAt: Date.now() };
}
