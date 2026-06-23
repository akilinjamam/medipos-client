import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { Loader2, ScanBarcode, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  useLazyGetProductByBarcodeQuery,
  useListProductsQuery,
} from '@/features/products/productsApi';
import { useDebounce } from '@/hooks/useDebounce';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCachedProductByBarcode, searchCachedProducts } from '@/db/catalog';
import { apiErrorMessage } from '@/lib/apiError';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/types/api';

interface ProductSearchProps {
  /** Called when the cashier picks a product (the batch picker opens next). */
  onPick: (product: Product) => void;
}

export function ProductSearch({ onPick }: ProductSearchProps) {
  const [term, setTerm] = useState('');
  const search = useDebounce(term.trim(), 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();

  // Online: live search the server. Offline: read the IndexedDB catalog cache.
  const { data, isFetching, isError, error } = useListProductsQuery(
    { search: search || undefined, limit: 20 },
    { skip: !online },
  );
  const cached = useLiveQuery(
    () => (online ? undefined : searchCachedProducts(search, 20)),
    [online, search],
  );
  const [lookupBarcode, { isFetching: isScanning }] = useLazyGetProductByBarcodeQuery();

  const products: Product[] = online ? (data?.data ?? []) : (cached ?? []);
  const loading = online ? isFetching : cached === undefined;

  /**
   * Keyboard support:
   *  - F2 explicitly focuses the search box.
   *  - Keyboard-wedge scanners type the barcode fast and end with Enter; if a
   *    printable key is pressed while nothing editable is focused, pull focus
   *    back here so a scan from anywhere on the screen lands in the box.
   * Both pause while a modal owns the keyboard.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return; // a modal owns input
      if (e.key === 'F2') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement;
      const editable =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (!editable) inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = term.trim();
    if (!code) return;

    // Scanner path: try an exact barcode match first (server online, cache offline).
    try {
      const product = online
        ? await lookupBarcode(code).unwrap()
        : await getCachedProductByBarcode(code);
      if (product) {
        onPick(product);
        setTerm('');
        inputRef.current?.focus();
        return;
      }
    } catch {
      // Not a known barcode — fall through to the keyboard path.
    }

    // Keyboard path: Enter picks the top search hit.
    if (products.length > 0) {
      onPick(products[0]);
      setTerm('');
      inputRef.current?.focus();
    } else {
      toast.info(`No product matches “${code}”.`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search or scan a barcode — Enter adds the match…"
          className="pl-9 pr-9"
          aria-label="Search or scan product"
        />
        {loading || isScanning ? (
          <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <ScanBarcode className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {online && isError && (
        <p className="text-sm text-destructive">{apiErrorMessage(error)}</p>
      )}

      <div className="flex flex-col gap-1.5">
        {loading && products.length === 0 &&
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}

        <AnimatePresence initial={false}>
          {products.map((p) => (
            <motion.button
              key={p._id}
              type="button"
              onClick={() => onPick(p)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[p.strength, p.brand, p.genericName].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <span className="ml-3 shrink-0 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {p.category}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>

        {!loading && products.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search
              ? 'No medicines match your search.'
              : online
                ? 'No products in the catalog yet.'
                : 'No cached products. Reconnect to sync the catalog.'}
          </p>
        )}
      </div>
    </form>
  );
}
