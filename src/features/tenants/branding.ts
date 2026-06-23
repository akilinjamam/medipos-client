import type { TenantBranding } from '@/types/api';

/** Fallback shop name when no white-label branding is set (interim env override). */
const FALLBACK_NAME = import.meta.env.VITE_SHOP_NAME || 'MediPOS';

/** Resolve the business name shown in the shell / on the receipt. */
export function businessName(branding: TenantBranding | null | undefined): string {
  return branding?.businessName || FALLBACK_NAME;
}

/** The branding header fields used when printing a thermal receipt. */
export function receiptBranding(branding: TenantBranding | null | undefined) {
  return {
    businessName: businessName(branding),
    addressLine: branding?.addressLine,
    phone: branding?.phone,
    logoUrl: branding?.logoUrl,
    footer: branding?.invoiceFooter,
  };
}
