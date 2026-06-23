import { motion } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

export function OnlineStatus() {
  const online = useOnlineStatus();

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        online
          ? 'bg-emerald-500/10 text-emerald-600'
          : 'bg-amber-500/10 text-amber-600',
      )}
    >
      {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
      {online ? 'Online' : 'Offline'}
    </motion.div>
  );
}
