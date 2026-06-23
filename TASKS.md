# MediPOS — POS Terminal (`medipos-client`) — Task List

> **App role:** the offline-capable POS terminal used by cashiers/managers at the counter.
> **This is the offline-first PWA** — its hardest, most differentiating requirement is billing with **no network** (Gold+ tenants). See spec §9 and root `CLAUDE.md` "Offline Sync Flow".
>
> **Stack:** React + **Vite** (PWA) · TypeScript · Redux Toolkit + **RTK Query** (state + API) · Tailwind CSS · shadcn/ui · framer-motion · react-hook-form + zod · React Router · Dexie (IndexedDB) · `vite-plugin-pwa` (Workbox).
>
> **Backend:** all endpoints live under **`/api/v1`**. Auth = short-lived JWT access token (in memory) + **refresh token in httpOnly cookie** (cookie path is `/api/v1/auth`, so the refresh call must hit that path with `credentials: 'include'`). Programmatic `X-API-Key` is for server-to-server only — the POS uses the cookie/JWT flow. Roles: `owner | manager | cashier`.
>
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Project scaffold & foundations

- [ ] `npm create vite@latest` → React + TypeScript (SWC) in this folder
- [ ] Install & configure **Tailwind CSS** (+ `tailwindcss-animate` for shadcn)
- [ ] Init **shadcn/ui** (`components.json`, `@/components/ui`, `cn()` util, path alias `@/*` in `tsconfig` + `vite.config`)
- [ ] Add **framer-motion**, **react-hook-form**, **zod**, **@hookform/resolvers**
- [ ] Add **Redux Toolkit** + **react-redux**; create `store.ts` and typed `useAppDispatch`/`useAppSelector`
- [ ] Add **RTK Query** base API (`baseQuery` → `${VITE_API_URL}/api/v1`, `credentials: 'include'`, attaches `Authorization: Bearer` from auth slice)
- [ ] Add **React Router** with a route layout + protected-route wrapper
- [ ] Add **Dexie** for IndexedDB (offline catalog + sale queue)
- [ ] Configure **`vite-plugin-pwa`** (Workbox, `registerType: 'autoUpdate'`, manifest, app-shell precache)
- [ ] ESLint + Prettier (mirror server conventions), `.env.example` (`VITE_API_URL`)
- [ ] Shared TypeScript API types — mirror server models (Product, Batch, Sale, Customer, Tenant, plan features). Consider generating from server zod schemas later.

## Phase 1 — Auth & shell (Silver MVP)

- [ ] **Login screen** (`POST /api/v1/auth/login`) — react-hook-form + zod, phone/email + password
- [ ] Store access token in memory (Redux), **not** localStorage; rely on httpOnly refresh cookie
- [ ] **Silent refresh** on 401 (`POST /api/v1/auth/refresh`, `credentials: 'include'`) with RTK Query re-auth + request retry/queue
- [ ] **`GET /api/v1/auth/me`** on boot to hydrate session (user, role, tenant, plan, branchId)
- [ ] **Logout** (`POST /api/v1/auth/logout`) — clears cookie + local state
- [ ] Protected route gate (redirect to login when unauthenticated)
- [ ] App shell: top bar (branch name, cashier, online/offline indicator), nav, toasts (shadcn `sonner`)
- [ ] Role awareness in UI — cashier vs manager (manager sees returns, reports link, etc.)

## Phase 1 — Catalog & billing (Silver MVP, the core POS screen)

- [x] **Product search** UI (`GET /api/v1/products?search=` and barcode lookup `GET /api/v1/products/barcode/:code`) — debounced, keyboard-first
- [x] **Barcode scanner input** (keyboard-wedge friendly) — Enter does an exact barcode lookup (`/products/barcode/:code`) then falls back to the top search hit; a global keydown refocuses the search box so a scan from anywhere lands there (skipped while a modal is open)
- [x] **Batch picker / FEFO** — when adding a product, fetch batches (`GET /api/v1/batches?productId=`) FEFO-ordered, default to the first (near-expiry badges); qty stepper → cart. (`batchesApi` also exposes the `/batches/fefo` multi-batch planner for later auto-allocation)
- [x] **Cart state** (Redux slice): line items `{ productId, batchId, qty, unitPrice, discount }`, totals, per-line discount. (cart-level discount: still per-line only — server has no cart-discount field)
- [x] **Checkout panel** — payment method (`cash | bkash | nagad | card | due`), paid/due amount, customer attach
- [x] **Finalize sale** online (`POST /api/v1/sales`) — surfaces insufficient-stock / oversell (409) errors as a toast, keeps the cart for re-pick
- [x] **Invoice view + print** — (a) thermal HTML receipt printed at finalize via a self-contained popup with `@page` 58/80mm sizing, offline, named lines (`src/lib/printReceipt.ts`); (b) PDF invoice (`GET /api/v1/sales/:id/invoice`) opened from Recent Sales (S3 URL; local-disk fallback has no public URL)
- [x] Recent sales list (`GET /api/v1/sales`) and sale detail (`GET /api/v1/sales/:id`) — `RecentSales` modal (header "Recent sales"), paginated newest-first, drill into line items + invoice reprint
- [x] **Customer quick-attach / quick-create** (`GET /api/v1/customers?search=`, `POST /api/v1/customers`) for due/credit sales
- [x] Keyboard shortcuts (add item, qty, pay, new sale) — `F2` focus search · scan/Enter adds · batch picker autofocuses qty + Enter adds · `F4` customer · `F8` finalize · `F9` new sale (suppressed while a modal is open); on-screen `Kbd` hints. See `src/hooks/useHotkeys.ts`
- [x] Route/code-splitting — `LoginPage`/`PosPage` are `React.lazy` (Suspense in `App.tsx`); vendor split via `manualChunks` (react/redux/motion/dexie). Largest chunk ~298 kB; >500 kB build warning cleared

## Phase 2 — Offline-first PWA (Gold+ — THE differentiator, §9)

> Gate all of this behind the tenant's `offlineMode` plan feature (from `/me`). Silver tenants run online-only.

- [x] **IndexedDB schema (Dexie):** `products`, `batches` (read-only catalog cache, full docs keyed by `id`), `saleQueue`, `meta` (last sync + synced branch) — `src/db/db.ts`; read/write layer in `src/db/catalog.ts` (`replaceCatalog`, `searchCachedProducts`, `getCachedProductByBarcode`, `getCachedBatches`, `getLastSync`, `clearCatalog`)
- [x] **Catalog sync on login** + periodic refresh — `src/features/offline/syncCatalog.ts` (paginated products + branch in-stock batches → IndexedDB) driven by `useOfflineCatalogSync` (on mount, on reconnect, every 5 min); gated behind `offlineMode` plan feature (plan from `GET /tenants/:id` → `auth.plan`). Header `OfflineSyncStatus` shows state + manual re-sync. Reference data stays read-only offline (§9.5)
- [x] **Service worker** (Workbox via `vite-plugin-pwa`): precache app shell, `navigateFallback` to `index.html` with `/api` denylist, runtime-cache catalog GETs (`/api/v1/products|batches`) NetworkFirst (`medipos-catalog`, 5s timeout, 24h). Primary offline reads stay on IndexedDB; this is a secondary layer
- [x] **Offline detection** — `useOnlineStatus` drives a plan-aware `OfflineBanner`; `ProductSearch` + `BatchPicker` fall back to the **cached** catalog (`db/catalog.ts` via `useLiveQuery`) when offline; connectivity-only actions gated (Recent sales, customer attach, finalize disabled offline with hints)
- [x] **Offline sale capture** — finalize while offline queues the sale to Dexie `saleQueue` with a `clientUuid` (uuid v4) and decrements the *local* batch cache for UX; prints the thermal receipt immediately. Full-payment only offline (due needs a connection). `src/db/saleQueue.ts` + `CheckoutPanel.captureOffline`
- [x] **Background sync** — `useOfflineSaleSync` POSTs pending sales to `POST /api/v1/sales/bulk-sync` (idempotent via `clientUuid`) on reconnect / when pending rises; reconciles each result → `synced` or `flagged` (conflict), with toasts. Header `OfflineQueueStatus` shows queued / to-review counts
- [x] **Conflict handling UI** — depleted-batch sales come back `conflict` → stored `flagged` with the server reason; surfaced in the queue's "Needs review" filter with the reason + Retry/Remove (never silently oversold)
- [x] **Queue management screen** — `src/features/offline/SaleQueue.tsx` (header "Queue" chip → modal): filter by all/pending/review/synced, line details, manual "Sync now", Retry conflicts, receipt reprint, Remove, Clear synced
- [~] PWA install prompt + icons + offline splash — `public/pwa-icon.svg` (maskable-safe) wired in the manifest (`any maskable`); `InstallButton` via `useInstallPrompt` (`beforeinstallprompt`); splash from manifest theme/background. Lighthouse PWA audit still to run manually

## Phase 2 — Returns & multi-branch (Gold)

- [x] **Sale returns/refunds** (manager/owner): `ReturnDialog` from the sale detail (`POST /api/v1/sales/:id/returns`) — pick returnable lines + qty, prorated-discount refund preview, reason; invalidates Sale/Batch/Product/Customer so detail/stock/due refresh. History via `ReturnsHistory` modal (header "Returns", manager/owner + online): paginated `GET /sales/returns` with items + refund split + reason inline
- [x] **Branch context** — `BranchSwitcher` in the header shows the current branch (`GET /api/v1/branches`); owner/manager on a multi-branch tenant can switch (also lets an owner with no JWT branch pick one). Switching clears the cart and re-syncs the catalog (the active branch flows from `selectActiveBranchId` into catalog sync, batch picker, checkout, recent sales). Online-only
- [x] Role guards in UI: the Return action is owner/manager only (`selectIsManager`); the server also `requireRole`s it

## Phase 3 — Platinum niceties (POS-side)

- [x] **Prescription history** quick-view — `PrescriptionHistory` modal opened from the attached-customer chip (an "Rx" button shown only when `features.prescriptionHistory` + online); reads `GET /api/v1/customers/:id/prescriptions` (Platinum-gated server-side), lists date/doctor/notes + attachment badge
- [x] **White-label branding** — `GET /api/v1/tenants/branding` → `auth.branding`; business name + logo in the header, accent colour via `--primary`/`--ring` (`useBrandingTheme`, Platinum-gated), and business name/logo/address/phone/footer on the thermal receipt (`features/tenants/branding.ts` `receiptBranding`). Replaces the `VITE_SHOP_NAME` stopgap (now just a fallback)
- [x] Cross-branch stock visibility hint — `CrossBranchHint` in the batch picker shows other branches' on-hand stock for a product when the current branch is short (`≤5` on hand, online); read-only, points to the dashboard for transfers (`GET /batches?productId=` across branches + branch names)

## Cross-cutting / polish

- [ ] **framer-motion**: cart add/remove, screen transitions, toast/queue animations (keep snappy — this is a fast-use counter tool)
- [x] Error boundary + global API error → toast mapping (mirror server `ApiError` shape) — `src/components/ErrorBoundary.tsx` (recoverable fallback + reload, dev-only message) wraps the app in `main.tsx`; API errors map via `lib/apiError.ts`
- [x] Loading/skeleton states (shadcn `Skeleton`) — batch picker, recent sales, sale queue, returns history, prescriptions, **product search**, **customer search**; boot/auth gate shows a spinner (`ProtectedRoute`) and lazy routes a Suspense fallback
- [~] Accessibility — full keyboard operation (hotkeys) done; modals labelled (`aria-labelledby/describedby`, focus-on-open, Escape), connectivity `role="status"` live regions (`OnlineStatus`/`OfflineBanner`), accessible names on icon-only/ambiguous controls (qty steppers, discount/paid inputs). Remaining: high-contrast pass + larger touch targets audit
- [x] Thermal-printer-friendly receipt CSS (58mm/80mm) — `src/lib/printReceipt.ts` (popup + `@page size`); default 80mm, `widthMm` switch for 58mm
- [ ] Env-driven config; build + preview; deploy as static files behind nginx (VPS/aaPanel)
- [~] Tests: Vitest + RTL set up (`vitest.config.ts`, `test/setup.ts`); 7 files / 31 tests green — cart reducer+selectors, offline-sync slice, plan features, currency, datetime, apiError, Kbd (RTL smoke). Still TODO: Dexie `saleQueue`/`catalog` (needs `fake-indexeddb`), store-connected component tests, Playwright offline→online smoke

---

### Endpoints this app consumes (quick reference, all under `/api/v1`)
`auth/login`, `auth/refresh`, `auth/logout`, `auth/me` · `products` (+ `?search`, `/barcode/:code`) · `batches` (+ `/fefo`, `?productId`) · `sales` (`GET`, `POST`, `/:id`, `/:id/invoice`, `/:id/returns`, `/returns`, `/bulk-sync`) · `customers` (search/create) · `tenants/branding`
