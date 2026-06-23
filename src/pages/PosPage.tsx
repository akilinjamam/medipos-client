import { useState } from 'react';
import { History, LogOut, RotateCcw } from 'lucide-react';
import { OnlineStatus } from '@/components/OnlineStatus';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/store/hooks';
import { selectCartItemCount } from '@/features/cart/cartSlice';
import {
  selectFeatures,
  selectActiveBranchId,
  selectBranding,
  selectIsManager,
} from '@/features/auth/authSlice';
import { useLogoutMutation } from '@/features/auth/authApi';
import { BranchSwitcher } from '@/features/branches/BranchSwitcher';
import { useGetTenantQuery, useGetBrandingQuery } from '@/features/tenants/tenantsApi';
import { useBrandingTheme } from '@/features/tenants/useBrandingTheme';
import { businessName } from '@/features/tenants/branding';
import { useOfflineCatalogSync } from '@/features/offline/useOfflineCatalogSync';
import { useOfflineSaleSync } from '@/features/offline/useOfflineSaleSync';
import { OfflineSyncStatus } from '@/features/offline/OfflineSyncStatus';
import { OfflineQueueStatus } from '@/features/offline/OfflineQueueStatus';
import { SaleQueue } from '@/features/offline/SaleQueue';
import { OfflineBanner } from '@/features/offline/OfflineBanner';
import { InstallButton } from '@/components/InstallButton';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { ProductSearch } from '@/features/pos/ProductSearch';
import { BatchPicker } from '@/features/pos/BatchPicker';
import { Cart } from '@/features/pos/Cart';
import { CheckoutPanel } from '@/features/pos/CheckoutPanel';
import { RecentSales } from '@/features/sales/RecentSales';
import { ReturnsHistory } from '@/features/sales/ReturnsHistory';
import type { Product } from '@/types/api';

/**
 * POS / billing screen (TASKS §Phase 1). Catalog search → batch/FEFO picker →
 * cart → checkout → finalize sale, with optional customer attach for due sales.
 */
export default function PosPage() {
  const user = useAppSelector((s) => s.auth.user);
  const itemCount = useAppSelector(selectCartItemCount);
  const features = useAppSelector(selectFeatures);
  const branchId = useAppSelector(selectActiveBranchId);
  const branding = useAppSelector(selectBranding);
  const isManager = useAppSelector(selectIsManager);
  const online = useOnlineStatus();
  const [logout, { isLoading }] = useLogoutMutation();

  // Load the tenant plan (populates auth.plan → features) so offline billing is
  // gated correctly; then keep the offline catalog cache fresh for Gold+. The
  // catalog re-syncs automatically when the active branch changes.
  useGetTenantQuery(user?.tenantId ?? '', { skip: !user?.tenantId });
  // White-label branding: load it and apply the accent colour (Platinum).
  useGetBrandingQuery(undefined, { skip: !user });
  useBrandingTheme();
  const { resync } = useOfflineCatalogSync({
    branchId,
    enabled: features.offlineMode,
  });
  // Flush any queued offline sales whenever we're online (Gold+).
  const { flush } = useOfflineSaleSync({ enabled: features.offlineMode });

  // The product whose batch picker is open (null = closed).
  const [picking, setPicking] = useState<Product | null>(null);
  // Recent-sales modal; `salesKey` remounts it so it reopens on the list view.
  const [salesOpen, setSalesOpen] = useState(false);
  const [salesKey, setSalesKey] = useState(0);
  // Offline sale-queue modal.
  const [queueOpen, setQueueOpen] = useState(false);
  // Returns-history modal (manager/owner).
  const [returnsOpen, setReturnsOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          {branding?.logoUrl && (
            <img src={branding.logoUrl} alt="" className="h-7 w-auto" />
          )}
          <span className="text-lg font-semibold">{businessName(branding)}</span>
          <BranchSwitcher />
        </div>
        <div className="flex items-center gap-4">
          <OnlineStatus />
          {features.offlineMode && <OfflineSyncStatus onResync={resync} />}
          {features.offlineMode && (
            <OfflineQueueStatus onClick={() => setQueueOpen(true)} />
          )}
          <InstallButton />
          {user && (
            <span className="text-sm text-muted-foreground">
              {user.name} · <span className="capitalize">{user.role}</span>
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!online}
            title={online ? undefined : 'Unavailable offline'}
            onClick={() => {
              setSalesKey((k) => k + 1);
              setSalesOpen(true);
            }}
          >
            <History className="size-4" />
            Recent sales
          </Button>
          {isManager && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!online}
              title={online ? undefined : 'Unavailable offline'}
              onClick={() => setReturnsOpen(true)}
            >
              <RotateCcw className="size-4" />
              Returns
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => logout()} disabled={isLoading}>
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      </header>

      <OfflineBanner />

      <main className="grid min-h-0 flex-1 gap-6 p-6 lg:grid-cols-[1fr_380px]">
        {/* Catalog / search */}
        <section className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <h2 className="text-sm font-medium text-muted-foreground">Catalog</h2>
          <ProductSearch onPick={setPicking} />
        </section>

        {/* Current sale */}
        <aside className="flex min-h-0 flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Current sale</h2>
            {itemCount > 0 && <Badge variant="secondary">{itemCount} items</Badge>}
          </div>
          <Cart />
          <CheckoutPanel branchId={branchId} />
        </aside>
      </main>

      <BatchPicker
        key={picking?._id ?? 'none'}
        product={picking}
        branchId={branchId}
        onClose={() => setPicking(null)}
      />

      <RecentSales
        key={salesKey}
        open={salesOpen}
        onClose={() => setSalesOpen(false)}
        branchId={branchId}
      />

      <SaleQueue
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        online={online}
        onSyncNow={flush}
      />

      <ReturnsHistory
        open={returnsOpen}
        onClose={() => setReturnsOpen(false)}
        branchId={branchId}
      />
    </div>
  );
}
