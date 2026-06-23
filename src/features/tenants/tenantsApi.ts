import { baseApi } from '@/store/api/baseApi';
import { setBranding, setPlan } from '@/features/auth/authSlice';
import type { Envelope, Tenant, TenantBranding } from '@/types/api';

export const tenantsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // GET /api/v1/tenants/:id — the tenant doc (plan, branding, limits).
    // Used to learn the plan so the POS can gate offline billing (Gold+).
    getTenant: builder.query<Tenant, string>({
      query: (id) => ({ url: `/tenants/${id}` }),
      transformResponse: (res: Envelope<Tenant>) => res.data,
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setPlan(data.plan));
        } catch {
          // Plan stays null → features default to silver (offline disabled).
        }
      },
    }),

    // GET /api/v1/tenants/branding — white-label branding for the auth'd tenant
    // (returns `{}` when unset). Read is open to any plan; only Platinum can set it.
    getBranding: builder.query<TenantBranding, void>({
      query: () => ({ url: '/tenants/branding' }),
      transformResponse: (res: Envelope<TenantBranding>) => res.data,
      async onQueryStarted(_a, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setBranding(data));
        } catch {
          // Branding stays null → shell + receipt use defaults.
        }
      },
    }),
  }),
});

export const { useGetTenantQuery, useGetBrandingQuery } = tenantsApi;
