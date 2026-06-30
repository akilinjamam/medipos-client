import { Building2 } from 'lucide-react';
import { useListBatchesQuery } from '@/features/batches/batchesApi';
import { useGetBranchesQuery } from '@/features/branches/branchesApi';

/**
 * Read-only hint shown when the current branch is short on a product: where else
 * in the tenant it's in stock (spec §12 — cross-branch visibility). Transfers
 * are initiated from the dashboard, not the POS. Renders nothing when no other
 * branch has stock. Queries all-branch batches for the product (no branchId).
 */
export function CrossBranchHint({
  productId,
  currentBranchId,
}: {
  productId: string;
  currentBranchId?: string;
}) {
  const { data: allBatches } = useListBatchesQuery({ productId, inStock: true });
  const { data: branches } = useGetBranchesQuery();

  if (!allBatches || !branches) return null;

  const byBranch = new Map<string, number>();
  for (const b of allBatches) {
    if (b.branchId === currentBranchId) continue;
    byBranch.set(b.branchId, (byBranch.get(b.branchId) ?? 0) + b.quantityInStock);
  }

  const rows = [...byBranch.entries()]
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ name: branches.find((b) => b.id === id)?.name ?? 'Branch', qty }))
    .sort((a, b) => b.qty - a.qty);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-dashed bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Building2 className="size-4" />
        Available at other branches
      </div>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex justify-between">
            <span className="text-muted-foreground">{r.name}</span>
            <span className="tabular-nums">{r.qty} in stock</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Request a stock transfer from the dashboard.
      </p>
    </div>
  );
}
