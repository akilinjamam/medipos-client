// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ConnectivityModule = typeof import('@/lib/connectivity');

// The store keeps module-level state (reachability flag, timers, listeners),
// so each test gets a fresh copy via resetModules + dynamic import.
async function loadStore(): Promise<ConnectivityModule> {
  vi.resetModules();
  return import('@/lib/connectivity');
}

let onLine = true;

beforeEach(() => {
  vi.useFakeTimers();
  onLine = true;
  vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => onLine);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('connectivity store', () => {
  it('is optimistic at boot when the browser reports online', async () => {
    const store = await loadStore();
    expect(store.isEffectivelyOnline()).toBe(true);
  });

  it('reads offline when navigator.onLine is false, regardless of the server', async () => {
    const store = await loadStore();
    onLine = false;
    expect(store.isEffectivelyOnline()).toBe(false);
  });

  it('flips offline and notifies subscribers on a reported network error', async () => {
    const store = await loadStore();
    const listener = vi.fn();
    store.subscribeConnectivity(listener);

    store.reportNetworkError();

    expect(store.isEffectivelyOnline()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it('recovers when a retry probe reaches the server', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const store = await loadStore();
    store.subscribeConnectivity(() => {});
    store.reportNetworkError();
    expect(store.isEffectivelyOnline()).toBe(false);

    await vi.advanceTimersByTimeAsync(store.RETRY_MS);

    expect(store.isEffectivelyOnline()).toBe(true);
  });

  it('detects silent loss via the heartbeat while idle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const store = await loadStore();
    store.subscribeConnectivity(() => {});
    expect(store.isEffectivelyOnline()).toBe(true);

    await vi.advanceTimersByTimeAsync(store.HEARTBEAT_MS);

    expect(store.isEffectivelyOnline()).toBe(false);
  });

  it('probes immediately on the browser online event', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const store = await loadStore();
    store.subscribeConnectivity(() => {});
    store.reportNetworkError();
    onLine = false;
    expect(store.isEffectivelyOnline()).toBe(false);

    onLine = true;
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0); // flush the in-flight probe

    expect(fetchMock).toHaveBeenCalled();
    expect(store.isEffectivelyOnline()).toBe(true);
  });

  it('stops probing once the last subscriber unsubscribes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const store = await loadStore();
    const unsubscribe = store.subscribeConnectivity(() => {});
    unsubscribe();

    await vi.advanceTimersByTimeAsync(store.HEARTBEAT_MS * 3);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
