import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/store/store';
import { clearCredentials, setAccessToken, setSubscriptionExpired } from '@/features/auth/authSlice';
import { apiErrorCode, SUBSCRIPTION_EXPIRED } from '@/lib/apiError';

const API_ROOT = `${import.meta.env.VITE_API_URL}/api/v1`;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_ROOT,
  // Send/receive the httpOnly refresh cookie (path /api/v1/auth on the server).
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

/**
 * Wraps the base query with silent refresh: on a 401, hit /auth/refresh once,
 * store the new access token, and replay the original request. A failed refresh
 * clears credentials (user is bounced to login by the route guard).
 */
export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  // Subscription enforcement: the server 402s every business route for lapsed
  // tenants (auth + tenants stay exempt). The flag drives the blocking overlay.
  if (result.error?.status === 402 && apiErrorCode(result.error) === SUBSCRIPTION_EXPIRED) {
    api.dispatch(setSubscriptionExpired(true));
  }

  if (result.error?.status === 401) {
    const refresh = await rawBaseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions,
    );

    // Server wraps every response in `{ data: ... }`, so the token is at .data.data.
    const body = refresh.data as { data?: { accessToken?: string } } | undefined;
    const newToken = body?.data?.accessToken;
    if (newToken) {
      api.dispatch(setAccessToken(newToken));
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(clearCredentials());
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'Product', 'Batch', 'Sale', 'Customer', 'Return'],
  endpoints: () => ({}),
});
