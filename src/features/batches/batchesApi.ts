import { baseApi } from '@/store/api/baseApi';
import type { Batch, Envelope, FefoAllocation } from '@/types/api';

export interface ListBatchesArgs {
  productId?: string;
  branchId?: string;
  /** When true, only batches with stock on hand. */
  inStock?: boolean;
}

export interface FefoArgs {
  productId: string;
  branchId: string;
  quantity: number;
}

export const batchesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/v1/batches — server returns them FEFO-ordered (expiryDate asc).
    listBatches: builder.query<Batch[], ListBatchesArgs>({
      query: ({ productId, branchId, inStock }) => ({
        url: '/batches',
        params: {
          ...(productId ? { productId } : {}),
          ...(branchId ? { branchId } : {}),
          ...(inStock !== undefined ? { inStock: String(inStock) } : {}),
        },
      }),
      transformResponse: (res: Envelope<Batch[]>) => res.data,
      providesTags: ['Batch'],
    }),

    // GET /api/v1/batches/fefo — multi-batch allocation plan for a quantity.
    getFefo: builder.query<FefoAllocation, FefoArgs>({
      query: ({ productId, branchId, quantity }) => ({
        url: '/batches/fefo',
        params: { productId, branchId, quantity },
      }),
      transformResponse: (res: Envelope<FefoAllocation>) => res.data,
      providesTags: ['Batch'],
    }),
  }),
});

export const { useListBatchesQuery, useGetFefoQuery, useLazyGetFefoQuery } = batchesApi;
