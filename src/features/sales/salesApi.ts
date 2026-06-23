import { baseApi } from '@/store/api/baseApi';
import type {
  BulkSyncResult,
  CreateReturnBody,
  CreateSaleBody,
  Envelope,
  OfflineSaleBody,
  Paginated,
  Sale,
  SaleReturn,
  StoredObject,
} from '@/types/api';

export interface ListReturnsArgs {
  branchId?: string;
  saleId?: string;
  page?: number;
  limit?: number;
}

export interface ListSalesArgs {
  branchId?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

export const salesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // POST /api/v1/sales — finalize an online sale (transactional, no oversell).
    // A 409 here means a batch was depleted under concurrency; surface it to the UI.
    createSale: builder.mutation<Sale, CreateSaleBody>({
      query: (body) => ({ url: '/sales', method: 'POST', body }),
      transformResponse: (res: Envelope<Sale>) => res.data,
      // Stock changed and the catalog cache is now stale.
      invalidatesTags: ['Sale', 'Batch', 'Product'],
    }),

    // GET /api/v1/sales — recent sales (paginated, newest first).
    listSales: builder.query<Paginated<Sale>, ListSalesArgs>({
      query: ({ branchId, customerId, page = 1, limit = 20 }) => ({
        url: '/sales',
        params: {
          ...(branchId ? { branchId } : {}),
          ...(customerId ? { customerId } : {}),
          page,
          limit,
        },
      }),
      providesTags: ['Sale'],
    }),

    // GET /api/v1/sales/:id — single sale detail.
    getSale: builder.query<Sale, string>({
      query: (id) => ({ url: `/sales/${id}` }),
      transformResponse: (res: Envelope<Sale>) => res.data,
      providesTags: ['Sale'],
    }),

    // GET /api/v1/sales/:id/invoice — generates + stores the PDF, returns its URL.
    getInvoice: builder.query<StoredObject, string>({
      query: (id) => ({ url: `/sales/${id}/invoice` }),
      transformResponse: (res: Envelope<StoredObject>) => res.data,
    }),

    // POST /api/v1/sales/bulk-sync — flush the offline queue (Gold+, idempotent
    // per clientUuid). Each result is synced/duplicate/conflict (§9).
    bulkSync: builder.mutation<BulkSyncResult[], OfflineSaleBody[]>({
      query: (sales) => ({ url: '/sales/bulk-sync', method: 'POST', body: { sales } }),
      transformResponse: (res: Envelope<BulkSyncResult[]>) => res.data,
      invalidatesTags: ['Sale', 'Batch', 'Product'],
    }),

    // POST /api/v1/sales/:id/returns — record a return/refund (owner/manager).
    // Restocks batches + reverses due/cash, so the sale, stock and ledger change.
    createReturn: builder.mutation<SaleReturn, { saleId: string; body: CreateReturnBody }>({
      query: ({ saleId, body }) => ({ url: `/sales/${saleId}/returns`, method: 'POST', body }),
      transformResponse: (res: Envelope<SaleReturn>) => res.data,
      invalidatesTags: ['Sale', 'Batch', 'Product', 'Customer', 'Return'],
    }),

    // GET /api/v1/sales/returns — returns history (paginated, newest first).
    listReturns: builder.query<Paginated<SaleReturn>, ListReturnsArgs>({
      query: ({ branchId, saleId, page = 1, limit = 20 }) => ({
        url: '/sales/returns',
        params: {
          ...(branchId ? { branchId } : {}),
          ...(saleId ? { saleId } : {}),
          page,
          limit,
        },
      }),
      providesTags: ['Return'],
    }),

    // GET /api/v1/sales/returns/:returnId — single return detail.
    getReturn: builder.query<SaleReturn, string>({
      query: (id) => ({ url: `/sales/returns/${id}` }),
      transformResponse: (res: Envelope<SaleReturn>) => res.data,
      providesTags: ['Return'],
    }),
  }),
});

export const {
  useCreateSaleMutation,
  useListSalesQuery,
  useGetSaleQuery,
  useLazyGetInvoiceQuery,
  useBulkSyncMutation,
  useCreateReturnMutation,
  useListReturnsQuery,
  useGetReturnQuery,
} = salesApi;
