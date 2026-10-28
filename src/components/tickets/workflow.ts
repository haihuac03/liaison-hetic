import type { Ticket } from "@/lib/types";

export type WorkflowRow = Record<string, unknown>;

export type WorkflowTicket = Ticket & {
  interventions?: WorkflowRow[];
  closures?: WorkflowRow[];
  closureRequests?: WorkflowRow[];
  agreements?: WorkflowRow[];
  disputes?: WorkflowRow[];
  workflow?: Record<string, unknown>;
};

const readRows = (source: unknown, ...keys: string[]): WorkflowRow[] => {
  if (!source || typeof source !== "object") return [];
  const row = source as Record<string, unknown>;
  for (const key of keys) {
    const value = row[key];
    if (Array.isArray(value)) return value.filter((item): item is WorkflowRow => Boolean(item) && typeof item === "object");
  }
  return [];
};

export function rowsFor(ticket: Ticket, key: "interventions" | "closures" | "agreements" | "disputes") {
  const source = ticket as WorkflowTicket;
  const nested = source.workflow && typeof source.workflow === "object" ? source.workflow : {};
  const direct = readRows(source, key);
  if (direct.length) return direct;
  const nestedRows = readRows(nested, key);
  if (nestedRows.length) return nestedRows;
  if (key === "closures") return [...readRows(source, "closureRequests", "closure_requests"), ...readRows(nested, "closureRequests", "closure_requests")];
  if (key === "interventions") return readRows(source, "intervention");
  if (key === "agreements") return readRows(source, "agreement");
  return readRows(source, "dispute");
}

export function rowValue(row: WorkflowRow | null | undefined, ...keys: string[]): unknown {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export function rowText(row: WorkflowRow | null | undefined, ...keys: string[]): string {
  const value = rowValue(row, ...keys);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function rowNumber(row: WorkflowRow | null | undefined, ...keys: string[]): number | null {
  const value = rowValue(row, ...keys);
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function rowId(row: WorkflowRow): string {
  return rowText(row, "id", "intervention_id", "request_id", "dispute_id", "agreement_id");
}

export function rowVersion(row: WorkflowRow): number {
  return rowNumber(row, "version") ?? 0;
}

export function rowStatus(row: WorkflowRow): string {
  return rowText(row, "status", "state").toLowerCase();
}

export function formatWorkflowDate(value: unknown, withTime = true): string {
  if (value === undefined || value === null || value === "") return "Date non renseignée";
  const numeric = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  const parsed = Number.isFinite(numeric) ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric) : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

export function formatCents(value: unknown): string {
  const cents = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(cents)) return "Non renseigné";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function parseFileIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

export function ticketTimestamp(ticket: Ticket, field: "created" | "updated"): number {
  const explicit = field === "created" ? ticket.createdTimestamp : ticket.updatedTimestamp;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  const source = field === "created" ? ticket.createdAt : ticket.updatedAt;
  const parsed = Date.parse(source);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    proposed: "En attente du locataire",
    pending: "En attente",
    open: "En attente",
    accepted: "Acceptée",
    awaiting_confirmation: "Réalisée, à confirmer",
    refused: "Refusée",
    declined: "Refusée",
    completed: "Réalisée, à confirmer",
    confirmed: "Confirmée",
    contested: "Contestée",
    withdrawn: "Retirée",
    active: "En cours",
    resolved: "Réglé",
  };
  return labels[status] || (status ? status.replace(/[_-]+/g, " ") : "Non renseigné");
}
