/**
 * Effective-connectivity store backing `useOnlineStatus`.
 *
 * `navigator.onLine` is only trustworthy as a NEGATIVE signal: Chromium
 * reports "online" whenever any network interface is up, so a Hyper-V/WSL
 * virtual adapter, or a live LAN whose internet link is dead (router up,
 * ISP down — the real-world pharmacy failure mode), keeps it `true` forever.
 * The POS therefore treats itself as online only when BOTH hold:
 *
 *   effective online = navigator.onLine && server reachable
 *
 * Server reachability transitions:
 *  - any API call failing at the transport level reports in via
 *    `reportNetworkError()` (wired in baseApi) → unreachable immediately
 *  - while reachable, a GET /health heartbeat every HEARTBEAT_MS catches
 *    silent loss on an idle terminal
 *  - while unreachable, /health is retried every RETRY_MS; any HTTP response
 *    (status irrelevant — the network path works) flips back to reachable
 *
 * The /health probe deliberately lives outside /api/v1 on the server (no
 * auth, before the maintenance guard) and outside the service worker's
 * runtime-cache patterns, so it can never be answered from a cache.
 */

const HEALTH_URL = `${import.meta.env.VITE_API_URL}/health`;

export const HEARTBEAT_MS = 30_000;
export const RETRY_MS = 5_000;
const PROBE_TIMEOUT_MS = 5_000;

let serverReachable = true; // optimistic at boot; the first real API call corrects it
let probing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setReachable(next: boolean) {
  if (serverReachable === next) return;
  serverReachable = next;
  notify();
}

export function isEffectivelyOnline(): boolean {
  return navigator.onLine && serverReachable;
}

async function probe(): Promise<void> {
  if (probing) return;
  probing = true;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(HEALTH_URL, { cache: 'no-store', signal: controller.signal });
    setReachable(true);
  } catch {
    setReachable(false);
  } finally {
    clearTimeout(abortTimer);
    probing = false;
    schedule();
  }
}

/** (Re)arm the probe timer at the cadence the current state calls for. */
function schedule() {
  clearTimeout(timer);
  // No subscribers → the app isn't mounted; don't poll in the background.
  // No interface → every probe would fail; the 'online' event re-arms us.
  if (listeners.size === 0 || !navigator.onLine) return;
  timer = setTimeout(() => void probe(), serverReachable ? HEARTBEAT_MS : RETRY_MS);
}

function handleBrowserOnline() {
  notify();
  void probe(); // verify immediately rather than waiting a heartbeat
}

function handleBrowserOffline() {
  notify();
  clearTimeout(timer);
}

/**
 * Called by baseApi whenever a request dies at the transport level
 * (FETCH_ERROR / TIMEOUT_ERROR) — the fastest offline signal we have.
 */
export function reportNetworkError(): void {
  setReachable(false);
  schedule(); // drop to the fast RETRY_MS cadence
}

/** `useSyncExternalStore` subscribe. Timers/listeners run only while mounted. */
export function subscribeConnectivity(callback: () => void): () => void {
  const isFirst = listeners.size === 0;
  listeners.add(callback);
  if (isFirst) {
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);
    schedule();
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      clearTimeout(timer);
    }
  };
}
