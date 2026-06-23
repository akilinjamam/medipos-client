import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '@/store/api/baseApi';
import authReducer from '@/features/auth/authSlice';
import cartReducer from '@/features/cart/cartSlice';
import offlineReducer from '@/features/offline/offlineSlice';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    cart: cartReducer,
    offline: offlineReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
