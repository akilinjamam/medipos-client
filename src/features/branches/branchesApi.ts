import { baseApi } from '@/store/api/baseApi';
import type { Branch, Envelope } from '@/types/api';

export const branchesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/v1/branches — the tenant's branches (read is open to any role).
    // Drives the branch context / switcher in the POS header.
    getBranches: builder.query<Branch[], void>({
      query: () => ({ url: '/branches' }),
      transformResponse: (res: Envelope<Branch[]>) => res.data,
    }),
  }),
});

export const { useGetBranchesQuery } = branchesApi;
