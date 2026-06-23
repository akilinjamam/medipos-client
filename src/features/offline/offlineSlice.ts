import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store/store';

export type CatalogSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface OfflineState {
  status: CatalogSyncStatus;
  /** Epoch ms of the last successful catalog sync (seeded from IndexedDB). */
  lastSyncedAt: number | null;
  productCount: number;
  batchCount: number;
  error?: string;
}

const initialState: OfflineState = {
  status: 'idle',
  lastSyncedAt: null,
  productCount: 0,
  batchCount: 0,
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    catalogSyncStarted(state) {
      state.status = 'syncing';
      state.error = undefined;
    },
    catalogSyncSucceeded(
      state,
      action: PayloadAction<{ productCount: number; batchCount: number; syncedAt: number }>,
    ) {
      state.status = 'synced';
      state.productCount = action.payload.productCount;
      state.batchCount = action.payload.batchCount;
      state.lastSyncedAt = action.payload.syncedAt;
      state.error = undefined;
    },
    catalogSyncFailed(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
    },
    /** Seed the last-sync time from IndexedDB on boot (before any new sync). */
    setLastSyncedAt(state, action: PayloadAction<number | null>) {
      state.lastSyncedAt = action.payload;
    },
  },
});

export const {
  catalogSyncStarted,
  catalogSyncSucceeded,
  catalogSyncFailed,
  setLastSyncedAt,
} = offlineSlice.actions;

export default offlineSlice.reducer;

export const selectOffline = (s: RootState) => s.offline;
