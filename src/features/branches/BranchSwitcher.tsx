import { useEffect } from 'react';
import { Store } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBranchesQuery } from '@/features/branches/branchesApi';
import {
  selectActiveBranchId,
  selectIsManager,
  setActiveBranch,
} from '@/features/auth/authSlice';
import { clearCart } from '@/features/cart/cartSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Branch context for the POS header. Shows the current branch; for owner/manager
 * on a multi-branch tenant it's a selector. Switching clears the in-progress
 * cart (line items are batch-specific to a branch) and the catalog re-syncs for
 * the new branch (the offline-sync hook keys on branchId). Online-only — a fresh
 * catalog can't be pulled offline.
 */
export function BranchSwitcher() {
  const dispatch = useAppDispatch();
  const online = useOnlineStatus();
  const isManager = useAppSelector(selectIsManager);
  const activeBranchId = useAppSelector(selectActiveBranchId);
  const { data: branches } = useGetBranchesQuery();

  const current = branches?.find((b) => b.id === activeBranchId);

  // When no valid branch is active — nothing persisted, no JWT branch, or a
  // stale id left over from a previous tenant/deleted branch — settle on a
  // sensible default so billing isn't blocked: the main branch, else the only
  // branch. Persisting it keeps the header and the batch picker consistent.
  // Multi-branch tenants with no main flagged are left to choose manually.
  useEffect(() => {
    if (!branches || branches.length === 0 || current) return;
    const fallback =
      branches.find((b) => b.isMainBranch) ??
      (branches.length === 1 ? branches[0] : undefined);
    if (fallback) dispatch(setActiveBranch(fallback.id));
  }, [branches, current, dispatch]);

  if (!branches || branches.length === 0) return null;

  const needsSelection = !current; // owner with no JWT branch must pick one
  const canSwitch = online && (needsSelection || (isManager && branches.length > 1));

  function handleChange(id: string) {
    if (!id || id === activeBranchId) return;
    dispatch(setActiveBranch(id));
    dispatch(clearCart());
    const name = branches?.find((b) => b.id === id)?.name;
    toast.message(`Switched to ${name ?? 'branch'}`, {
      description: 'Catalog is re-syncing for this branch.',
    });
  }

  if (!canSwitch) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Store className="size-4" />
        {current?.name ?? 'No branch'}
      </span>
    );
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Store className="size-4" />
      <span className="sr-only">Branch</span>
      <select
        value={current?.id ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {needsSelection && (
          <option value="" disabled>
            Select branch…
          </option>
        )}
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.isMainBranch ? ' (main)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
