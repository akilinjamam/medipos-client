import { useEffect, useRef } from 'react';

type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

/** True while any modal (`[role="dialog"]`) is mounted — so background hotkeys pause. */
export function isDialogOpen(): boolean {
  return Boolean(document.querySelector('[role="dialog"]'));
}

/**
 * Register window-level keyboard shortcuts keyed by `KeyboardEvent.key`
 * (e.g. `'F8'`). Handlers are kept in a ref so the latest closures are used
 * without re-subscribing the listener on every render. While a modal is open
 * the shortcuts are suppressed (the modal owns the keyboard) unless
 * `ignoreDialogs` is set.
 */
export function useHotkeys(map: HotkeyMap, ignoreDialogs = false) {
  const mapRef = useRef(map);
  useEffect(() => {
    mapRef.current = map;
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!ignoreDialogs && isDialogOpen()) return;
      const fn = mapRef.current[e.key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ignoreDialogs]);
}
