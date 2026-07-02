/** Shared API types mirroring the medipos-server models / responses. */

import type { Plan } from '@/config/planFeatures';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

/** White-label branding (Platinum) — applied to invoices/reports and receipts. */
export interface TenantBranding {
  businessName?: string;
  logoUrl?: string;
  primaryColor?: string;
  addressLine?: string;
  phone?: string;
  invoiceFooter?: string;
}

/** Mirrors server TenantDoc (the only non-tenant-scoped collection). */
export interface Tenant {
  id: string;
  name: string;
  /** Human-friendly login code staff type at sign-in instead of the raw id. */
  code?: string;
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: string;
  branchLimit: number;
  userLimit: number;
  branding?: TenantBranding;
  createdAt: string;
  updatedAt: string;
}

/** Single-document endpoints wrap the payload as `{ data: T }`. */
export interface Envelope<T> {
  data: T;
}

/** List endpoints return this shape directly (the array is in `data`). */
export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export type ProductCategory = 'OTC' | 'Rx' | 'Controlled';

/** Payment methods accepted at the counter (mirrors server sale schema). */
export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'card' | 'due';

/** Mirrors server ProductDoc as serialized to JSON (the global toJSON plugin maps `_id` -> `id`). */
export interface Product {
  id: string;
  tenantId: string;
  name: string;
  genericName?: string;
  brand?: string;
  manufacturer?: string;
  dosageForm?: string;
  strength?: string;
  category: ProductCategory;
  unit?: string;
  unitsPerBox?: number;
  barcode?: string;
  reorderLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors server BranchDoc as serialized to JSON. */
export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  phone?: string;
  isMainBranch: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors server BatchDoc as serialized to JSON. Stock is tracked per batch. */
export interface Batch {
  id: string;
  tenantId: string;
  productId: string;
  branchId: string;
  batchNo: string;
  expiryDate: string;
  costPrice: number;
  sellPrice: number;
  quantityInStock: number;
  supplierId?: string;
  purchaseDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** One line of a FEFO allocation plan (server `GET /batches/fefo`). */
export interface FefoAllocationLine {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  sellPrice: number;
  quantity: number;
}

export interface FefoAllocation {
  productId: string;
  branchId: string;
  requested: number;
  allocated: number;
  fulfillable: boolean;
  lines: FefoAllocationLine[];
}

/** Mirrors server CustomerDoc (prescription history omitted — Platinum read). */
export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone?: string;
  dueBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors server PrescriptionEntry (Platinum read). */
export interface PrescriptionEntry {
  date: string;
  doctorName?: string;
  notes?: string;
  /** Storage key for a scanned prescription (no public URL from the POS). */
  fileKey?: string;
}

/** Response of `GET /customers/:id/prescriptions` (Platinum-gated). */
export interface PrescriptionHistory {
  customerId: string;
  name: string;
  phone?: string;
  prescriptions: PrescriptionEntry[];
}

export type ReturnStatus = 'none' | 'partial' | 'full';

/** Mirrors server SaleItem. */
export interface SaleItem {
  productId: string;
  batchId: string;
  batchNo: string;
  qty: number;
  unitPrice: number;
  discount: number;
  costPrice: number;
  returnedQty: number;
}

/** Mirrors server SaleDoc as serialized to JSON. */
export interface Sale {
  id: string;
  tenantId: string;
  branchId: string;
  cashierId: string;
  customerId?: string;
  items: SaleItem[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  returnStatus: ReturnStatus;
  refundedAmount: number;
  syncedFromOffline: boolean;
  clientUuid?: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors server SaleReturnItem (refund computed off original-sale snapshots). */
export interface SaleReturnItem {
  productId: string;
  batchId: string;
  batchNo: string;
  qty: number;
  unitPrice: number;
  discount: number;
  costPrice: number;
}

/** Mirrors server SaleReturnDoc — a return/refund against a finalized Sale. */
export interface SaleReturn {
  id: string;
  tenantId: string;
  saleId: string;
  branchId: string;
  customerId?: string;
  processedBy: string;
  items: SaleReturnItem[];
  refundAmount: number;
  /** Portion applied against the customer's outstanding due. */
  dueReversed: number;
  /** Portion handed back as cash (refundAmount − dueReversed). */
  cashRefunded: number;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Request body for `POST /sales/:id/returns` (server createReturnSchema). */
export interface CreateReturnBody {
  items: { batchId: string; qty: number }[];
  reason?: string;
}

/** Request body for `POST /sales` (mirrors server createSaleSchema). */
export interface CreateSaleItem {
  productId: string;
  batchId: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface CreateSaleBody {
  branchId: string;
  customerId?: string;
  items: CreateSaleItem[];
  paymentMethod: PaymentMethod;
  paidAmount?: number;
}

/** One queued offline sale as POSTed to `/sales/bulk-sync` (server offlineSaleSchema). */
export interface OfflineSaleBody extends CreateSaleBody {
  clientUuid: string;
  /** ISO timestamp captured at the counter (preserves the real sale time). */
  createdAt: string;
}

export type SyncResultStatus = 'synced' | 'duplicate' | 'conflict';

/** Per-sale outcome from `POST /sales/bulk-sync` (server SyncResult). */
export interface BulkSyncResult {
  clientUuid: string;
  status: SyncResultStatus;
  saleId?: string;
  reason?: string;
}

/** Result of persisting a generated PDF (server `config/storage` StoredObject). */
export interface StoredObject {
  key: string;
  /** https URL when on S3; a non-openable `file://` path on the local-disk fallback. */
  url: string;
  storage: 's3' | 'local';
}
