import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { featuresForPlan, type Plan } from '@/config/planFeatures';
import type { RootState } from '@/store/store';
import type { TenantBranding } from '@/types/api';

// The active branch is remembered across reloads (it's not a secret — an owner
// has no JWT branch, so without this they'd be re-prompted to pick on every
// reload). The access token is deliberately NOT persisted.
const ACTIVE_BRANCH_KEY = 'medipos.activeBranchId';

function loadActiveBranch(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_BRANCH_KEY) : null;
  } catch {
    return null;
  }
}

function persistActiveBranch(branchId: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (branchId) localStorage.setItem(ACTIVE_BRANCH_KEY, branchId);
    else localStorage.removeItem(ACTIVE_BRANCH_KEY);
  } catch {
    // Ignore storage failures (private mode, quota) — falls back to JWT branch.
  }
}

// Non-secret session snapshot so an OFFLINE reload doesn't log the cashier out
// (load-shedding: PC reboots with no internet → the boot refresh can't run).
// Deliberately excludes the access token (memory-only, unchanged); restoring
// this only lets the UI boot — the 401→refresh flow re-auths on reconnect, and
// an expired refresh cookie still lands on /login once online.
const SESSION_CACHE_KEY = 'medipos.sessionCache';

export interface SessionCache {
  user: AuthUser;
  plan: Plan | null;
  branding: TenantBranding | null;
}

function persistSessionCache(state: AuthState): void {
  try {
    if (typeof localStorage === 'undefined' || !state.user) return;
    const cache: SessionCache = { user: state.user, plan: state.plan, branding: state.branding };
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures — offline reload just won't survive, as before.
  }
}

export function loadSessionCache(): SessionCache | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_CACHE_KEY) : null;
    if (!raw) return null;
    const cache = JSON.parse(raw) as SessionCache;
    return cache.user ? cache : null;
  } catch {
    return null;
  }
}

export function clearSessionCache(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // Ignore.
  }
}

/**
 * Auth state for the POS terminal.
 *
 * The access token is kept in memory ONLY (never localStorage) — the refresh
 * token lives in an httpOnly cookie scoped to /api/v1/auth on the server, and a
 * silent refresh re-hydrates the access token on 401 / reload. Roles come from
 * the server: owner | manager | cashier.
 */
export type Role = 'owner' | 'manager' | 'cashier';

/** Mirrors the server's `PublicUser` (auth.service.ts). */
export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  branchId?: string;
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  /** The tenant's plan, loaded from `/tenants/:id` after sign-in (gates offline). */
  plan: Plan | null;
  /** Branch the POS is operating on; null → fall back to the user's JWT branch. */
  activeBranchId: string | null;
  /** White-label branding for the tenant (Platinum); `{}`/null when unset. */
  branding: TenantBranding | null;
  /** True until the boot-time /auth/me + refresh attempt resolves. */
  initializing: boolean;
  /** Set when the API rejects with 402 SUBSCRIPTION_EXPIRED — blocks the POS until renewal. */
  subscriptionExpired: boolean;
  /** Set when the API 503s with MAINTENANCE_MODE — full-screen maintenance takeover. */
  maintenanceActive: boolean;
  maintenanceMessage?: string;
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
  plan: null,
  activeBranchId: loadActiveBranch(),
  branding: null,
  initializing: true,
  subscriptionExpired: false,
  maintenanceActive: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{ accessToken: string; user: AuthUser }>,
    ) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      persistSessionCache(state);
    },
    setAccessToken(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload;
    },
    setUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      persistSessionCache(state);
    },
    setPlan(state, action: PayloadAction<Plan | null>) {
      state.plan = action.payload;
      persistSessionCache(state);
    },
    setActiveBranch(state, action: PayloadAction<string | null>) {
      state.activeBranchId = action.payload;
      persistActiveBranch(action.payload);
    },
    setBranding(state, action: PayloadAction<TenantBranding | null>) {
      state.branding = action.payload;
      persistSessionCache(state);
    },
    /**
     * Boot-time offline restore: the refresh call failed with a NETWORK error
     * (not a 401) and a cached snapshot exists — bring the session back with
     * no access token so the POS can bill from the local catalog.
     */
    sessionRestored(state, action: PayloadAction<SessionCache>) {
      state.user = action.payload.user;
      state.plan = action.payload.plan;
      state.branding = action.payload.branding;
    },
    setSubscriptionExpired(state, action: PayloadAction<boolean>) {
      state.subscriptionExpired = action.payload;
    },
    setMaintenance(state, action: PayloadAction<{ active: boolean; message?: string }>) {
      state.maintenanceActive = action.payload.active;
      state.maintenanceMessage = action.payload.message;
    },
    clearCredentials(state) {
      state.accessToken = null;
      state.user = null;
      state.plan = null;
      state.activeBranchId = null;
      state.branding = null;
      state.subscriptionExpired = false;
      persistActiveBranch(null);
      clearSessionCache();
    },
    setInitializing(state, action: PayloadAction<boolean>) {
      state.initializing = action.payload;
    },
  },
});

export const {
  setCredentials,
  setAccessToken,
  setUser,
  setPlan,
  setActiveBranch,
  setBranding,
  setSubscriptionExpired,
  setMaintenance,
  sessionRestored,
  clearCredentials,
  setInitializing,
} = authSlice.actions;
export default authSlice.reducer;

/** Tenant white-label branding (business name/logo/colours), or null when unset. */
export const selectBranding = (s: RootState) => s.auth.branding;

/** The branch the POS is billing for — the explicit choice, else the JWT branch. */
export const selectActiveBranchId = (s: RootState) =>
  s.auth.activeBranchId ?? s.auth.user?.branchId;

/** Plan-derived feature flags for the current tenant (offlineMode etc.). */
export const selectFeatures = (s: RootState) => featuresForPlan(s.auth.plan);

/** True for owner/manager — stock-affecting actions (returns) are gated to them. */
export const selectIsManager = (s: RootState) =>
  s.auth.user?.role === 'owner' || s.auth.user?.role === 'manager';

/** True while the server is 402-blocking the tenant (subscription lapsed). */
export const selectSubscriptionExpired = (s: RootState) => s.auth.subscriptionExpired;

/** True while the platform maintenance switch is on (server 503s everything). */
export const selectMaintenanceActive = (s: RootState) => s.auth.maintenanceActive;
export const selectMaintenanceMessage = (s: RootState) => s.auth.maintenanceMessage;
