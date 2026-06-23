# MediPOS — POS Terminal (`medipos-client`) — Status

Progress of `medipos-client` against [`TASKS.md`](./TASKS.md).
Backend integration notes (how to talk to `medipos-server`) are at the bottom.

Legend: ✅ done · 🟡 partial · ❌ not started

> Last updated: 2026-06-23 · Build: `npm run build` green · `tsc -b` clean · `eslint .` clean (2 pre-existing shadcn `*Variants` fast-refresh warnings)

---

## ✅ / 🟡 by phase

### Phase 0 — Scaffold & foundations  → ✅ essentially complete
- ✅ Vite + React + TypeScript (manual scaffold, SWC)
- ✅ Tailwind CSS **v4** (`@tailwindcss/vite`, CSS-first theme in `src/index.css`)
- ✅ shadcn/ui wired (`components.json`, `@/*` alias, `cn()` in `src/lib/utils.ts`, `@/components/ui`)
- ✅ framer-motion, react-hook-form, zod, `@hookform/resolvers`
- ✅ Redux Toolkit + react-redux — `src/store/store.ts`, typed hooks `src/store/hooks.ts`
- ✅ RTK Query base API — `src/store/api/baseApi.ts` (`/api/v1`, `credentials:'include'`, Bearer, silent refresh)
- ✅ React Router + protected-route wrapper — `src/App.tsx`, `src/router/ProtectedRoute.tsx`
- ✅ Dexie (IndexedDB) schema stub — `src/db/db.ts` (`products`, `batches`, `saleQueue`, `meta`)
- ✅ `vite-plugin-pwa` (Workbox, autoUpdate, app-shell precache) — `vite.config.ts`
- ✅ ESLint + Prettier + `.env.example`
- ✅ Shared TS API types — `src/types/api.ts` has `Envelope`, `Paginated`, `Product`, `Batch`, `FefoAllocation`, `Customer`, `Sale`/`SaleItem`, `CreateSaleBody`, `PaymentMethod`, `StoredObject`, `Tenant`/`TenantBranding`; plan/features mirror in `src/config/planFeatures.ts`; auth types in `authSlice`.

### Phase 1 — Auth & shell  → 🟡 auth done, shell minimal
- ✅ Login screen — `POST /api/v1/auth/login` (react-hook-form + zod: `tenantId`+`phone`+`password`), `src/pages/LoginPage.tsx`
- ✅ Access token in memory only (Redux), refresh via httpOnly cookie
- ✅ Silent refresh on 401 — `baseQueryWithReauth` in `src/store/api/baseApi.ts`
- ✅ Boot session revival — `POST /auth/refresh` → `GET /auth/me` in `App.tsx`, then flips `initializing`
- ✅ Logout — `POST /auth/logout` + clears state (`authApi`, header button in `PosPage`)
- ✅ Protected route gate — redirect to `/login` when unauthenticated
- ✅ Toasts (sonner) + API error mapping (`src/lib/apiError.ts`, parses `{ error: { message } }`)
- 🟡 App shell — header with online/offline + offline-sync/queue indicators, branch context (`BranchSwitcher`), user/role; no sidebar nav (modal-based by design)
- ✅ Role awareness — role shown and used to gate UI: returns + branch switch are owner/manager only (`selectIsManager`)

### Phase 1 — Catalog & billing  → ✅ complete (online Silver MVP billing flow end-to-end)
- ✅ Product search UI — `src/features/pos/ProductSearch.tsx` (debounced, animated, loading/empty/error states; Enter-to-add)
- ✅ Products catalog API slice — `src/features/products/productsApi.ts` (`listProducts`, lazy `getProductByBarcode`)
- ✅ Barcode scanner input (keyboard-wedge) — Enter → exact barcode lookup → top-hit fallback; global keydown refocuses the search box (skipped while a `[role="dialog"]` modal is open)
- ✅ Batch picker / FEFO — `src/features/pos/BatchPicker.tsx` (modal; lists in-stock batches FEFO-ordered, FEFO/near-expiry/expired badges, qty stepper) + `src/features/batches/batchesApi.ts` (`listBatches`, `getFefo`)
- ✅ Cart state — `src/features/cart/cartSlice.ts` (line items keyed by batch, qty clamp to stock, per-line discount, customer attach, selectors) + `src/features/pos/Cart.tsx` (animated line editor)
- ✅ Checkout panel — `src/features/pos/CheckoutPanel.tsx` (payment method, paid/due, customer attach, finalize)
- ✅ Finalize sale online — `POST /api/v1/sales` via `src/features/sales/salesApi.ts`; 409 oversell surfaced as toast, cart retained
- ✅ Invoice view + print — thermal HTML receipt printed at finalize (`src/lib/printReceipt.ts`: self-contained popup, `@page` 58/80mm, offline, named lines via the cart) + PDF invoice from Recent Sales (`getInvoice`, S3 URL; local-disk `file://` fallback isn't browser-openable)
- ✅ Recent sales list + detail — `src/features/sales/RecentSales.tsx` (header "Recent sales" modal; paginated newest-first list, drill into a sale's line items by batch, invoice reprint). Detail shows items receipt-style by `batchNo` — full product names live on the PDF invoice
- ✅ Customer quick-attach / quick-create — `src/features/customers/CustomerPicker.tsx` + `customersApi.ts` (`listCustomers`, `createCustomer`)
- ✅ Keyboard shortcuts — `src/hooks/useHotkeys.ts` + `Kbd` hints: `F2` focus search, scan/Enter adds top hit, batch picker autofocuses qty + Enter adds, `F4` attach customer, `F8` finalize, `F9` new sale. Function keys avoid the printable-key wedge capture; all suppressed while a `[role="dialog"]` modal is open

### Phase 2 — Offline-first PWA (Gold+)  → ✅ functionally complete (only a manual Lighthouse PWA audit remains)
- ✅ IndexedDB schema (Dexie) — `src/db/db.ts` (catalog rows store full docs keyed by `id`; `meta` holds last-sync + synced branch) + read/write layer `src/db/catalog.ts`
- ✅ Catalog sync on login + periodic refresh — `src/features/offline/{syncCatalog,useOfflineCatalogSync,offlineSlice}.ts`; pulls paginated products + branch in-stock batches; runs on mount, on reconnect, every 5 min; **gated by `offlineMode`** (plan via `GET /tenants/:id` → `auth.plan`, client mirror in `src/config/planFeatures.ts`). Header `OfflineSyncStatus` shows state + manual re-sync
- ✅ Offline detection + UI gating — `useOnlineStatus` + plan-aware `OfflineBanner`; `ProductSearch`/`BatchPicker` read the **cached** catalog (`db/catalog.ts` via `dexie-react-hooks` `useLiveQuery`) when offline; server-only actions disabled offline (Recent sales, customer attach, finalize) with inline hints
- ✅ Service worker — precache app shell; `navigateFallback` → `index.html` with `/api` denylist; runtime-cache `/api/v1/products|batches` GETs NetworkFirst (`medipos-catalog`). Configured in `vite.config.ts` (verified in `dist/sw.js`)
- ✅ Offline sale capture — finalize offline → Dexie `saleQueue` (`clientUuid` uuid v4) + local batch-cache decrement + immediate thermal receipt; full-payment only (`src/db/saleQueue.ts`, `CheckoutPanel.captureOffline`)
- ✅ Background sync → `POST /api/v1/sales/bulk-sync` — `useOfflineSaleSync` flushes pending on reconnect/when pending rises (idempotent), reconciles `synced`/`flagged`, toasts summary
- ✅ Conflict / "needs review" handling — conflicts persisted as `flagged` with the server reason; shown in the queue's "Review" filter with Retry/Remove (never silently oversold)
- ✅ Queue management screen — `src/features/offline/SaleQueue.tsx` (header "Queue" chip → modal): all/pending/review/synced filters, line details, manual "Sync now", retry conflicts, receipt reprint, remove, clear-synced
- 🟡 PWA icons + install prompt — `public/pwa-icon.svg` (maskable) in the manifest; `InstallButton` (`useInstallPrompt`); offline splash via manifest theme/background. Lighthouse PWA audit not yet run

### Phase 2 — Returns & multi-branch (Gold)  → ✅ complete
- ✅ Returns/refunds — `src/features/sales/ReturnDialog.tsx` from the sale detail (owner/manager via `selectIsManager`); pick returnable lines + qty, prorated-discount refund preview, reason → `POST /sales/:id/returns`; invalidates Sale/Batch/Product/Customer. History: `src/features/sales/ReturnsHistory.tsx` modal (header "Returns", manager/owner + online) — paginated `GET /sales/returns`, items + refund split + reason inline
- ✅ Branch context / switch + catalog re-sync — `src/features/branches/{branchesApi,BranchSwitcher}.tsx`; active branch held in `auth.activeBranchId` (`selectActiveBranchId`, falls back to JWT branch) and flows into catalog sync / batch picker / checkout / recent sales. Owner/manager switch on multi-branch tenants; switching clears the cart + re-syncs the catalog. Online-only

### Phase 3 — Platinum (POS-side)  → ✅ complete
- ✅ Prescription history quick-view — `src/features/customers/PrescriptionHistory.tsx` modal from the attached-customer chip ("Rx" button, gated on `features.prescriptionHistory` + online); `getCustomerPrescriptions` (`GET /customers/:id/prescriptions`, Platinum server-gated)
- ✅ White-label branding on shell + receipt — `getBranding` → `auth.branding`; header business name + logo, accent colour via `--primary`/`--ring` (`useBrandingTheme`, Platinum-gated), receipt header/footer (`features/tenants/branding.ts`). `VITE_SHOP_NAME` is now just a fallback
- ✅ Cross-branch stock visibility hint — `src/features/pos/CrossBranchHint.tsx` in the batch picker; shows other branches' on-hand stock when the current branch is short (≤5, online), read-only with a "transfer from the dashboard" note

### Cross-cutting / polish  → 🟡
- 🟡 framer-motion — used in login, product search, online indicator; more screens pending
- ✅ Global API error → toast mapping
- ✅ Error boundary — `src/components/ErrorBoundary.tsx` wraps the app (`main.tsx`); recoverable fallback + reload, dev-only error detail
- ✅ Loading/skeleton states — `Skeleton` across batch picker, recent sales, sale queue, returns history, prescriptions, product search, customer search; boot/auth shows a spinner (`ProtectedRoute`), lazy routes a Suspense fallback
- 🟡 Accessibility — full keyboard operation + ARIA sweep done: modals labelled (`aria-labelledby/describedby` + focus-on-open via `Modal`), connectivity live regions (`role="status"` on `OnlineStatus`/`OfflineBanner`), accessible names on icon-only/ambiguous controls (qty steppers, discount/paid inputs). Remaining: high-contrast review + larger touch-target audit
- ✅ Thermal-printer receipt CSS (58/80mm) — `src/lib/printReceipt.ts` (`@page size`, monospace, dashed rules; `widthMm` 58|80)
- 🟡 Tests — Vitest + RTL set up (`vitest.config.ts` node default + per-file jsdom, `test/setup.ts`); 7 files / 31 tests green (cart, offline-sync slice, plan features, currency, datetime, apiError, Kbd smoke). TODO: Dexie `saleQueue`/`catalog` (needs `fake-indexeddb`), store-connected component tests, Playwright offline→online smoke
- ✅ Route code-splitting — `LoginPage`/`PosPage` lazy (Suspense in `App.tsx`) + vendor `manualChunks` (react/redux/motion/dexie) in `vite.config.ts`; largest chunk ~298 kB, >500 kB warning cleared

---

## ❓ Open decisions
- **Registration page** — deferred. `POST /api/v1/auth/register` creates a *user under an existing tenant* (defaults to `cashier`), not a tenant. Per the design doc this is an owner/manager action that belongs in **medipos-dashboard** (`/api/v1/users`), so the POS is **login-only** unless decided otherwise.

---

## Backend integration notes (`medipos-server`)

How this client connects to the API. Source of truth: `../medipos-server/CLAUDE.md` + `../pharmacy-pos-system-design.md`.

### Running the backend (required to exercise anything past login UI)
1. **MongoDB as a replica set** (even single-node) — sale finalize, `bulk-sync`, purchase receive, and transfers use multi-doc transactions. A standalone `mongod` throws *"Transaction numbers are only allowed on a replica set member."*
2. `medipos-server` needs a `.env` (zod-validated at boot; exits on missing vars). It currently runs on **`PORT=3000`**.
3. From `medipos-server/`: `npm run dev` (tsx watch).
4. Optional integrations (Redis / S3 / SMS / SSLCommerz) **degrade gracefully** — not needed for POS dev.

### Connection contract
- **Base URL:** client uses `VITE_API_URL` (default `http://localhost:3000`) and appends **`/api/v1`** itself. Set in `.env` (see `.env.example`). The Vite dev server is `:5173` — that is **not** the API.
- **CORS:** server `CORS_ORIGINS` already includes `http://localhost:5173` with `credentials: true`, so cookies work cross-origin in dev.
- **Auth:** short-lived **JWT access token** (kept in memory) + **refresh token in an httpOnly cookie** scoped to `path=/api/v1/auth`. All authed requests send `Authorization: Bearer <token>`; the client auto-refreshes on 401. Roles: `owner | manager | cashier`.
- **Response envelopes (important):**
  - Single-document & mutations → wrapped: `{ data: T }` (e.g. login → `{ data: { user, accessToken } }`, refresh → `{ data: { accessToken } }`, `me` → `{ data: PublicUser }`).
  - **List endpoints** → **not** double-wrapped: `{ data: T[], page, limit, total }` (the array is `data`).
  - Errors → `{ error: { message, details? } }` (mapped by `src/lib/apiError.ts`).

### Endpoints this client will consume (all under `/api/v1`)
| Area | Endpoints | Client status |
|---|---|---|
| Auth | `auth/login`, `auth/refresh`, `auth/logout`, `auth/me` | ✅ wired |
| Products | `products` (`?search,category,page,limit`), `products/barcode/:code` | ✅ slice; 🟡 UI (search only) |
| Batches | `batches` (`?productId,branchId,inStock`), `batches/fefo` | ✅ slice + batch picker UI |
| Sales | `sales` (`GET/POST`), `sales/:id`, `sales/:id/invoice`, `sales/:id/returns`, `sales/returns`, `sales/bulk-sync` | ✅ slice (all); ✅ UI (finalize, recent list+detail, invoice, returns/refunds, **returns history**, offline bulk-sync) |
| Customers | `customers` (search/create), `customers/:id/prescriptions` | ✅ slice + picker UI + Rx history modal |
| Branches | `branches` (list) | ✅ slice + `BranchSwitcher` (branch context/switch) |
| Tenant | `tenants/:id` (plan) | ✅ slice (`getTenant`) — used to gate offline by plan |
| Branding | `tenants/branding` | ✅ slice (`getBranding`) — shell + receipt white-labeling |

### Test data needed
Product search returns empty until the tenant has catalog rows. You need (in this tenant): a **Tenant**, at least one **User** to log in as, some **Products**, and **Batches** (for stock/FEFO once billing lands). Seed via the dashboard/API once available, or a server seed script (none confirmed yet).

> Keep this file in sync as screens land — mirror of `medipos-server/BACKEND_STATUS.md`.
