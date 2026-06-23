// Registers @testing-library/jest-dom matchers (e.g. toBeInTheDocument) with
// Vitest's expect. Safe in the node env too (it only extends expect). RTL's
// own auto-cleanup runs for the jsdom component tests that import it.
import '@testing-library/jest-dom/vitest';
