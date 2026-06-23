import { describe, it, expect } from 'vitest';
import { timeAgo } from '@/lib/datetime';

describe('timeAgo', () => {
  it('"just now" under 30s', () => {
    expect(timeAgo(Date.now())).toBe('just now');
    expect(timeAgo(Date.now() - 10_000)).toBe('just now');
  });

  it('seconds between 30 and 60', () => {
    expect(timeAgo(Date.now() - 45_000)).toBe('45s ago');
  });

  it('minutes', () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe('5m ago');
  });

  it('hours', () => {
    expect(timeAgo(Date.now() - 2 * 60 * 60_000)).toBe('2h ago');
  });

  it('days', () => {
    expect(timeAgo(Date.now() - 2 * 24 * 60 * 60_000)).toBe('2d ago');
  });
});
