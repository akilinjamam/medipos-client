import { useEffect, useState } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import {
  useCreateCustomerMutation,
  useLazyListCustomersQuery,
} from '@/features/customers/customersApi';
import { useDebounce } from '@/hooks/useDebounce';
import { apiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/currency';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Customer } from '@/types/api';

interface CustomerPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (customer: Customer) => void;
}

/**
 * Quick-attach an existing customer (search by name/phone) or quick-create one —
 * needed for due/credit sales. Mirrors `GET/POST /api/v1/customers`.
 */
export function CustomerPicker({ open, onClose, onPick }: CustomerPickerProps) {
  const [term, setTerm] = useState('');
  const search = useDebounce(term.trim(), 300);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [runSearch, { data: customers, isFetching, isError, error }] =
    useLazyListCustomersQuery();
  const [createCustomer, { isLoading: isCreating }] = useCreateCustomerMutation();

  // Re-query whenever the debounced term changes while the modal is open.
  // Transient state (term/creating/form) is reset by a `key` on this component
  // in the parent, so it starts clean on every open without a reset effect.
  useEffect(() => {
    if (open) runSearch({ search: search || undefined });
  }, [open, search, runSearch]);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const customer = await createCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
      }).unwrap();
      onPick(customer);
      onClose();
    } catch (err) {
      // Surface inline; the API-error toast also fires via the slice.
      setName(name);
      console.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach customer"
      description="Search an existing customer or create a new one for a due sale."
    >
      {creating ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Phone (optional)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Back to search
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
              {isCreating && <Loader2 className="size-4 animate-spin" />}
              Create & attach
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name or phone…"
              className="pl-9"
            />
            {isFetching && (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {isError && <p className="text-sm text-destructive">{apiErrorMessage(error)}</p>}

          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {isFetching &&
              !customers &&
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}

            {customers?.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => {
                  onPick(c);
                  onClose();
                }}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.phone || 'No phone'}
                  </div>
                </div>
                {c.dueBalance > 0 && (
                  <Badge variant="warning">Due {formatCurrency(c.dueBalance)}</Badge>
                )}
              </button>
            ))}

            {!isFetching && customers && customers.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No customers match.
              </p>
            )}
          </div>

          <Button variant="outline" onClick={() => setCreating(true)}>
            <UserPlus className="size-4" />
            New customer
          </Button>
        </div>
      )}
    </Modal>
  );
}
