import type { TenantBranding } from '@/types/api';
import { poweredByLine, PRODUCT_NAME } from '@/lib/company';

/** Fallback shop name when no white-label branding is set (interim env override). */
const FALLBACK_NAME = import.meta.env.VITE_SHOP_NAME || PRODUCT_NAME;

/** Resolve the business name shown in the shell / on the receipt. */
export function businessName(branding: TenantBranding | null | undefined): string {
  return branding?.businessName || FALLBACK_NAME;
}

/**
 * The branding header/footer fields used when printing a thermal receipt.
 * `whiteLabeled` (Platinum feature flag) suppresses the maker byline — a fully
 * clean receipt is what white-label tenants pay for.
 */
export function receiptBranding(
  branding: TenantBranding | null | undefined,
  whiteLabeled = false,
) {
  return {
    businessName: businessName(branding),
    addressLine: branding?.addressLine,
    phone: branding?.phone,
    logoUrl: branding?.logoUrl,
    footer: branding?.invoiceFooter,
    poweredBy: whiteLabeled ? undefined : poweredByLine,
  };
}
