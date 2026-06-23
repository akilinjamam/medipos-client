import { Download } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';

/** "Install app" action — only rendered while the browser offers a prompt. */
export function InstallButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  if (!canInstall) return null;

  return (
    <Button variant="outline" size="sm" onClick={promptInstall} title="Install MediPOS">
      <Download className="size-4" />
      Install
    </Button>
  );
}
