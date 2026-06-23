// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from '@/components/ui/kbd';

// Smoke test that the jsdom + RTL + jest-dom pipeline works for components.
describe('<Kbd>', () => {
  it('renders its children', () => {
    render(<Kbd>F8</Kbd>);
    expect(screen.getByText('F8')).toBeInTheDocument();
  });
});
