import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Minimal centered modal built on framer-motion (no extra radix dependency).
 * Closes on Escape and backdrop click; the body scrolls if content overflows.
 */
export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Move focus into the dialog on open (for keyboard/SR users) unless something
  // inside already grabbed it (e.g. an autoFocus search/qty input).
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (el && !el.contains(document.activeElement)) el.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border bg-card text-card-foreground shadow-lg outline-none',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div className="min-w-0">
                {title && (
                  <h2 id={titleId} className="text-base font-semibold">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-0.5 text-sm text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
