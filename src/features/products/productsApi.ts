import { baseApi } from '@/store/api/baseApi';
import type { Envelope, Paginated, Product, ProductCategory } from '@/types/api';

export interface ListProductsArgs {
  search?: string;
  category?: ProductCategory;
  page?: number;
  limit?: number;
}

export const productsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/v1/products — paginated, free-text search across name/generic/brand/barcode.
    listProducts: builder.query<Paginated<Product>, ListProductsArgs>({
      query: ({ search, category, page = 1, limit = 20 }) => ({
        url: '/products',
        params: {
          ...(search ? { search } : {}),
          ...(category ? { category } : {}),
          page,
          limit,
        },
      }),
      providesTags: ['Product'],
    }),

    // GET /api/v1/products/barcode/:barcode — single product (scanner path).
    getProductByBarcode: builder.query<Product, string>({
      query: (barcode) => ({ url: `/products/barcode/${encodeURIComponent(barcode)}` }),
      transformResponse: (res: Envelope<Product>) => res.data,
      providesTags: ['Product'],
    }),
  }),
});

export const { useListProductsQuery, useLazyGetProductByBarcodeQuery } = productsApi;
