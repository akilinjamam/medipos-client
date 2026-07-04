import { describe, it, expect } from 'vitest';
import authReducer, {
  setCredentials,
  setSubscriptionExpired,
  clearCredentials,
  type AuthUser,
} from '@/features/auth/authSlice';

const user: AuthUser = {
  id: 'u1',
  tenantId: 't1',
  name: 'Cashier',
  phone: '01700000000',
  role: 'cashier',
};

const initial = authReducer(undefined, { type: '@@INIT' });

describe('authSlice subscription block flag', () => {
  it('starts unblocked', () => {
    expect(initial.subscriptionExpired).toBe(false);
  });

  it('setSubscriptionExpired toggles the flag', () => {
    const blocked = authReducer(initial, setSubscriptionExpired(true));
    expect(blocked.subscriptionExpired).toBe(true);
    expect(authReducer(blocked, setSubscriptionExpired(false)).subscriptionExpired).toBe(false);
  });

  it('clearCredentials resets the flag along with the session', () => {
    const blocked = authReducer(
      authReducer(initial, setCredentials({ accessToken: 'abc', user })),
      setSubscriptionExpired(true),
    );
    const cleared = authReducer(blocked, clearCredentials());
    expect(cleared.subscriptionExpired).toBe(false);
    expect(cleared.accessToken).toBeNull();
    expect(cleared.user).toBeNull();
  });
});
