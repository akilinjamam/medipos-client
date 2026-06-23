import { baseApi } from '@/store/api/baseApi';
import type { Customer, Envelope, PrescriptionHistory } from '@/types/api';

export interface ListCustomersArgs {
  search?: string;
  hasDue?: boolean;
}

export interface CreateCustomerBody {
  name: string;
  phone?: string;
}

export const customersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/v1/customers — directory lookup at the counter (not paginated).
    listCustomers: builder.query<Customer[], ListCustomersArgs>({
      query: ({ search, hasDue }) => ({
        url: '/customers',
        params: {
          ...(search ? { search } : {}),
          ...(hasDue !== undefined ? { hasDue: String(hasDue) } : {}),
        },
      }),
      transformResponse: (res: Envelope<Customer[]>) => res.data,
      providesTags: ['Customer'],
    }),

    // POST /api/v1/customers — quick-create for a due/credit sale.
    createCustomer: builder.mutation<Customer, CreateCustomerBody>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      transformResponse: (res: Envelope<Customer>) => res.data,
      invalidatesTags: ['Customer'],
    }),

    // GET /api/v1/customers/:id/prescriptions — prescription history (Platinum).
    getCustomerPrescriptions: builder.query<PrescriptionHistory, string>({
      query: (id) => ({ url: `/customers/${id}/prescriptions` }),
      transformResponse: (res: Envelope<PrescriptionHistory>) => res.data,
      providesTags: ['Customer'],
    }),
  }),
});

export const {
  useLazyListCustomersQuery,
  useCreateCustomerMutation,
  useGetCustomerPrescriptionsQuery,
} = customersApi;
