import type { CoreState } from "@/lib/client/core";

export interface LeaseRecord {
  id: string;
  property_id?: string;
  propertyId?: string;
  owner_id?: string;
  ownerId?: string;
  tenant_id?: string | null;
  tenantId?: string | null;
  starts_on?: string;
  startsOn?: string;
  ends_on?: string | null;
  endsOn?: string | null;
  rent_cents?: number;
  rentCents?: number;
  charges_cents?: number;
  chargesCents?: number;
  deposit_cents?: number;
  depositCents?: number;
  payment_day?: number;
  paymentDay?: number;
  status?: string;
  version?: number;
  created_at?: number;
  updated_at?: number;
}

export interface RentPeriodRecord {
  id: string;
  lease_id?: string;
  leaseId?: string;
  period?: string;
  period_start?: string;
  period_month?: string;
  periodMonth?: string;
  due_on?: string;
  dueOn?: string;
  rent_cents?: number;
  rentCents?: number;
  charges_cents?: number;
  chargesCents?: number;
  total_cents?: number;
  totalCents?: number;
  status?: string;
  paid_at?: number | string | null;
  paidAt?: number | string | null;
  paid_on?: string | null;
  paidOn?: string | null;
}

export interface PropertyDocumentRecord {
  id: string;
  property_id?: string;
  propertyId?: string;
  lease_id?: string | null;
  leaseId?: string | null;
  period_id?: string | null;
  periodId?: string | null;
  name?: string;
  original_name?: string;
  originalName?: string;
  mime?: string;
  size?: number;
  kind?: string;
  category?: string;
  issued_on?: string;
  expires_on?: string | null;
  created_at?: number;
  createdAt?: number;
  uploaded_by?: string;
  uploadedBy?: string;
  uploaded_by_name?: string;
  uploadedByName?: string;
}

export type LeaseCoreState = Omit<CoreState, "leases" | "rent_periods" | "property_documents"> & {
  leases?: LeaseRecord[];
  rent_periods?: RentPeriodRecord[];
  property_documents?: PropertyDocumentRecord[];
};

export const leasePropertyId = (lease: LeaseRecord) =>
  lease.property_id ?? lease.propertyId ?? "";

export const leaseStartsOn = (lease: LeaseRecord) =>
  lease.starts_on ?? lease.startsOn ?? "";

export const leaseEndsOn = (lease: LeaseRecord) =>
  lease.ends_on ?? lease.endsOn ?? "";

export const leaseRentCents = (lease: LeaseRecord) =>
  lease.rent_cents ?? lease.rentCents ?? 0;

export const leaseChargesCents = (lease: LeaseRecord) =>
  lease.charges_cents ?? lease.chargesCents ?? 0;

export const leaseDepositCents = (lease: LeaseRecord) =>
  lease.deposit_cents ?? lease.depositCents ?? 0;

export const leasePaymentDay = (lease: LeaseRecord) =>
  lease.payment_day ?? lease.paymentDay ?? 1;

export const rentPeriodLeaseId = (period: RentPeriodRecord) =>
  period.lease_id ?? period.leaseId ?? "";

export const rentPeriodMonth = (period: RentPeriodRecord) =>
  period.period ?? period.period_start?.slice(0, 7) ?? period.period_month ?? period.periodMonth ?? "";

export const rentPeriodDueOn = (period: RentPeriodRecord) =>
  period.due_on ?? period.dueOn ?? "";

export const rentPeriodPaidOn = (period: RentPeriodRecord) =>
  period.paid_on ?? period.paidOn ?? period.paid_at ?? period.paidAt ?? null;

export const documentPropertyId = (document: PropertyDocumentRecord) =>
  document.property_id ?? document.propertyId ?? "";

export const documentLeaseId = (document: PropertyDocumentRecord) =>
  document.lease_id ?? document.leaseId ?? null;

export const documentName = (document: PropertyDocumentRecord) =>
  document.name ?? document.original_name ?? document.originalName ?? "Document";

export const documentCreatedAt = (document: PropertyDocumentRecord) =>
  document.created_at ?? document.createdAt ?? 0;

export function formatCents(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

export function formatLongDate(value?: string | number | null) {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatPeriod(value?: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1, 12);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

export function statusLabel(status?: string) {
  switch (status) {
    case "paid":
    case "paye":
    case "payé":
      return "Payé";
    case "due":
    case "pending":
    case "a_payer":
      return "À payer";
    case "late":
    case "overdue":
    case "retard":
      return "En retard";
    case "cancelled":
    case "annule":
      return "Annulé";
    default:
      return status ? status.replaceAll("_", " ") : "À échéance";
  }
}
