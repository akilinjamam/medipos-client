import { baseApi } from '@/store/api/baseApi';
import {
  clearCredentials,
  setAccessToken,
  setCredentials,
  setUser,
  type AuthUser,
} from '@/features/auth/authSlice';

/** The server wraps every successful payload in `{ data: ... }`. */
interface Envelope<T> {
  data: T;
}

export interface LoginRequest {
  tenantId: string;
  phone: string;
  password: string;
}

interface LoginPayload {
  user: AuthUser;
  accessToken: string;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginPayload, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: (res: Envelope<LoginPayload>) => res.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setCredentials(data));
      },
    }),

    refresh: builder.mutation<{ accessToken: string }, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
      transformResponse: (res: Envelope<{ accessToken: string }>) => res.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setAccessToken(data.accessToken));
      },
    }),

    getMe: builder.query<AuthUser, void>({
      query: () => ({ url: '/auth/me' }),
      transformResponse: (res: Envelope<AuthUser>) => res.data,
      providesTags: ['Auth'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setUser(data));
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(clearCredentials());
        }
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useGetMeQuery,
  useLogoutMutation,
} = authApi;
