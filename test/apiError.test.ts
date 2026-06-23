import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from '@/lib/apiError';

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
