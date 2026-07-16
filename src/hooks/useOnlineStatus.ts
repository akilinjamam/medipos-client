import { useSyncExternalStore } from 'react';
import { isEffectivelyOnline, subscribeConnectivity } from '@/lib/connectivity';

/**
 * Online/offline signal for the POS. Drives the connectivity banner and gates
 * features that require connectivity (purchases, inventory edits, reports).
 *
 * Backed by the connectivity store (`src/lib/connectivity.ts`): true only when
 * `navigator.onLine` AND the API server answers /health probes — a live LAN
 * with dead internet, or a virtual adapter keeping `navigator.onLine` true,
 * still reads as offline here.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeConnectivity, isEffectivelyOnline, () => true);
}
