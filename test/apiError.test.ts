import { describe, it, expect } from 'vitest';
import {
  apiErrorMessage,
  apiErrorStatus,
  apiErrorCode,
  SUBSCRIPTION_EXPIRED,
} from '@/lib/apiError';

describe('apiErrorMessage', () => {
  it('maps FETCH_ERROR to a connection message', () => {
    expect(apiErrorMessage({ status: 'FETCH_ERROR', error: 'x' })).toBe(
      'Cannot reach the server. Check your connection.',
    );
  });

  it('pulls the server error message out of the body', () => {
    expect(
      apiErrorMessage({ status: 400, data: { error: { message: 'Insufficient batch stock' } } }),
    ).toBe('Insufficient batch stock');
  });

  it('uses the fallback for unknown shapes', () => {
    expect(apiErrorMessage(undefined, 'Custom fallback')).toBe('Custom fallback');
    expect(apiErrorMessage({ status: 500, data: {} })).toBe('Something went wrong');
  });
});

describe('apiErrorStatus / apiErrorCode', () => {
  const expired = {
    status: 402,
    data: { error: { message: 'Your subscription has expired.', code: SUBSCRIPTION_EXPIRED } },
  };

  it('extracts the numeric status', () => {
    expect(apiErrorStatus(expired)).toBe(402);
    expect(apiErrorStatus({ status: 'FETCH_ERROR', error: 'x' })).toBeUndefined();
    expect(apiErrorStatus(undefined)).toBeUndefined();
  });

  it('extracts the machine-readable code', () => {
    expect(apiErrorCode(expired)).toBe('SUBSCRIPTION_EXPIRED');
    expect(apiErrorCode({ status: 403, data: { error: { message: 'Forbidden' } } })).toBeUndefined();
    expect(apiErrorCode(undefined)).toBeUndefined();
  });
});
