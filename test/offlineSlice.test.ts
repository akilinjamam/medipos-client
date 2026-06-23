import { describe, it, expect } from 'vitest';
import reducer, {
  catalogSyncStarted,
  catalogSyncSucceeded,
  catalogSyncFailed,
  setLastSyncedAt,
} from '@/features/offline/offlineSlice';

const initial = () => reducer(undefined, { type: '@@INIT' });

describe('offlineSlice (catalog sync status)', () => {
  it('starts in idle', () => {
    expect(initial().status).toBe('idle');
    expect(initial().lastSyncedAt).toBeNull();
  });

  it('marks syncing and clears prior error', () => {
    let state = reducer(initial(), catalogSyncFailed('boom'));
    state = reducer(state, catalogSyncStarted());
    expect(state.status).toBe('syncing');
    expect(state.error).toBeUndefined();
  });

  it('records counts + timestamp on success', () => {
    const state = reducer(
      initial(),
      catalogSyncSucceeded({ productCount: 12, batchCount: 34, syncedAt: 1000 }),
    );
    expect(state.status).toBe('synced');
    expect(state.productCount).toBe(12);
    expect(state.batchCount).toBe(34);
    expect(state.lastSyncedAt).toBe(1000);
  });

  it('records the error message on failure', () => {
    const state = reducer(initial(), catalogSyncFailed('network down'));
    expect(state.status).toBe('error');
    expect(state.error).toBe('network down');
  });

  it('setLastSyncedAt seeds the timestamp without changing status', () => {
    const state = reducer(initial(), setLastSyncedAt(555));
    expect(state.lastSyncedAt).toBe(555);
    expect(state.status).toBe('idle');
  });
});
