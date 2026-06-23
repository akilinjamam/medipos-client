import { useCallback, useEffect, useState } from 'react';

/** The non-standard `beforeinstallprompt` event (Chromium). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Capture the browser's install prompt so the POS can offer an explicit
 * "Install" action (PWA install on the counter machine). `canInstall` is true
 * only while the browser has offered a deferred prompt and the app isn't yet
 * installed.
 */
export function useInstallPrompt(): { canInstall: boolean; promptInstall: () => void } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep it from auto-showing; we trigger it on click
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(() => {
    if (!deferred) return;
    void (async () => {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null); // a prompt can only be used once
    })();
  }, [deferred]);

  return { canInstall: deferred !== null, promptInstall };
}
