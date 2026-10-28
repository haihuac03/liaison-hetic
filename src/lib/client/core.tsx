"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Attachment, DocumentItem, Ticket, TicketCategory, TicketStatus } from "../types";
import { STATUS_META } from "../meta";
import { useAuth } from "../auth";

export interface CoreIntervention {
  id: string; ticket_id: string; proposed_by: string; artisan_name: string; details: string;
  scheduled_start: number; scheduled_end: number; price_cents: number; status: string;
  version: number; report?: string | null; decision_reason?: string | null; created_at: number;
}
export interface CoreClosure {
  id: string; ticket_id: string; requester_id: string; subject: string; conditions: string;
  amount_cents?: number | null; file_ids?: string[]; payload_hash: string; version: number;
  status: string; created_at: number; decided_by?: string | null; decided_at?: number | null;
}
export interface CoreAgreement {
  id: string; ticket_id: string; closure_request_id: string; subject: string; conditions: string;
  amount_cents?: number | null; accepted_by: string; created_at: number; payload_hash: string; file_ids: string[];
}
export interface CoreDispute {
  id: string; ticket_id: string; opened_by: string; description: string; status: string; created_at: number;
}
export interface CoreEvent {
  seq: number; id?: string; ticket_id: string; actor_id: string | null; actor_role?: string;
  actor_name?: string; type: string; payload: Record<string, unknown>; created_at: number;
}

export interface CoreLease {
  id: string;
  property_id: string;
  owner_id: string;
  tenant_id: string;
  status: string;
  starts_on: string;
  ends_on: string | null;
  signed_on?: string | null;
  rent_cents: number;
  charges_cents: number;
  deposit_cents: number;
  payment_day: number;
  monthly_rent_cents?: number;
  created_at?: number;
  updated_at?: number;
}

export interface CoreRentPeriod {
  id: string;
  lease_id: string;
  period: string;
  due_on: string;
  status: string;
  rent_cents: number;
  charges_cents: number;
  total_cents: number;
  paid_at: number | null;
  created_at: number;
  version: number;
}

export interface CorePropertyDocument {
  id: string;
  property_id: string;
  lease_id?: string | null;
  name: string;
  mime: string;
  size: number;
  uploaded_by: string;
  created_at: number;
}

export interface CoreState {
  interventions?: CoreIntervention[];
  closures?: CoreClosure[];
  agreements?: CoreAgreement[];
  disputes?: CoreDispute[];
  leases?: CoreLease[];
  rent_periods?: CoreRentPeriod[];
  property_documents?: CorePropertyDocument[];
  user: { id: string; name: string; email: string; role: "owner" | "tenant" };
  properties: { id: string; address: string; owner_id: string; tenant_id: string | null; owner_name: string; tenant_name: string | null }[];
  tickets: { id: string; title: string; description: string; category: TicketCategory; status: TicketStatus; creator_id: string; creator_name: string; property_id: string; created_at: number; updated_at?: number; version?: number; owner_id?: string; tenant_id?: string; creator_role?: string; address?: string; owner_name?: string; tenant_name?: string }[];
  messages: { id: string; ticket_id: string; author_id: string; author_name: string; author_role: string; text: string; created_at: number }[];
  files: { id: string; ticket_id: string; message_id: string | null; name: string; mime: string; size: number; created_at?: number }[];
  invitations: { code: string; property_id: string; expires: number; used_at: number | null }[];
  notifications: { id: string; ticket_id: string; title: string; event_type?: "message" | "ticket" | "document" | "system"; read: number; created_at: number }[];
}
export async function coreRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/core/${path}`, { credentials: "same-origin", cache: "no-store", ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "La demande a échoué."), { status: response.status });
  return data;
}
export async function uploadAttachments(ticketId: string, attachments: Attachment[], messageId?: string) {
  if (!attachments.length) return;
  const form = new FormData();
  if (messageId) form.set("messageId", messageId);
  for (const attachment of attachments) {
    const response = await fetch(attachment.src);
    if (!response.ok) throw new Error("Impossible de lire la pièce jointe sélectionnée.");
    form.append("files", await response.blob(), attachment.name || attachment.alt);
  }
  const response = await fetch(`/api/core/upload/${encodeURIComponent(ticketId)}`, { method: "POST", body: form });
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Impossible de joindre les fichiers."); }
}
const date = (value: number) => new Date(value).toLocaleString("fr-FR");
export function mapCoreState(core: CoreState) {
  const documents: DocumentItem[] = core.files.map(file => ({ id: file.id, name: file.name, category: file.mime.startsWith("image/") ? "Photos" : "Constats", size: `${Math.ceil(file.size / 1024)} Ko`, date: file.created_at ? new Date(file.created_at).toLocaleDateString("fr-FR") : "", preview: `/api/core/file/${file.id}`, type: file.mime.startsWith("image/") ? "image" : "pdf", ticketId: file.ticket_id, description: file.name }));
  const tickets: Ticket[] = core.tickets.map(ticket => {
    const meta = STATUS_META[ticket.status] || STATUS_META.ouvert;
    const files = core.files.filter(file => file.ticket_id === ticket.id);
    const messages = core.messages.filter(message => message.ticket_id === ticket.id);
    const updatedAt = Math.max(ticket.updated_at || ticket.created_at, ...messages.map(message => message.created_at));
    const attachment = (file: CoreState["files"][number]): Attachment => ({ src: `/api/core/file/${file.id}`, alt: file.name, name: file.name, kind: file.mime.startsWith("image/") ? "image" : "file" });
    const otherRole = core.user.role === "owner" ? "tenant" : "owner";
    const correspondentRole = otherRole === "owner" ? "Bailleur" : "Locataire";
    const correspondent = messages.find(message => message.author_role === otherRole);
    const otherParty = (otherRole === "owner" ? ticket.owner_name : ticket.tenant_name) || correspondent?.author_name || (otherRole === "owner" ? "Votre bailleur" : "Votre locataire");
    const creatorName = ticket.creator_id === core.user.id ? core.user.name : ticket.creator_name || ticket.tenant_name || "Locataire";
    return {
      ...ticket, propertyId: ticket.property_id, createdTimestamp: ticket.created_at, updatedTimestamp: updatedAt, ownerId: ticket.owner_id, tenantId: ticket.tenant_id, creatorId: ticket.creator_id,
      address: ticket.address || core.properties.find(property => property.id === ticket.property_id)?.address,
      interventions: (core.interventions || []).filter(row => row.ticket_id === ticket.id),
      closures: (core.closures || []).filter(row => row.ticket_id === ticket.id),
      agreements: (core.agreements || []).filter(row => row.ticket_id === ticket.id),
      disputes: (core.disputes || []).filter(row => row.ticket_id === ticket.id),
      correspondentRole, shortTitle: ticket.title, badge: meta.label, badgeTone: meta.tone,
      createdAt: date(ticket.created_at), updatedAt: date(updatedAt), summary: ticket.description,
      progress: { step: 1, total: 5, label: meta.label }, assignee: otherParty,
      photos: files.filter(file => file.mime.startsWith("image/")).map(file => `/api/core/file/${file.id}`),
      documents: documents.filter(doc => doc.ticketId === ticket.id).map(doc => ({ ...doc, meta: "Pièce jointe" })),
      timeline: [{ id: `created-${ticket.id}`, title: "Ticket créé", meta: date(ticket.created_at), state: "done" }],
      messages: [{ id: `description-${ticket.id}`, author: ticket.creator_role === "owner" ? "claire" as const : "thomas" as const,
        isOwn: ticket.creator_id === core.user.id, authorName: creatorName, role: ticket.creator_role === "owner" ? "Bailleur" : "Locataire",
        time: date(ticket.created_at), text: ticket.description,
        attachments: files.filter(file => !file.message_id).map(attachment) },
        ...messages.map(message => ({ id: message.id, isOwn: message.author_id === core.user.id,
          author: message.author_role === "tenant" ? "thomas" as const : "claire" as const,
          authorName: message.author_name, role: message.author_role === "owner" ? "Bailleur" : "Locataire",
          text: message.text, time: date(message.created_at),
          attachments: files.filter(file => file.message_id === message.id).map(attachment) }))]
    };
  });
  return { tickets, documents, notifications: core.notifications.map(item => ({ id: item.id, title: item.title, detail: "", time: date(item.created_at), read: Boolean(item.read), href: `/tickets/${item.ticket_id}`, type: item.event_type || (/message/i.test(item.title) ? "message" : "ticket") })) };
}
export function useCoreSession() {
  const auth = useAuth();
  const userId = auth.user?.id;
  const [core, setCore] = useState<CoreState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshPromise = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;
    const task = (async () => {
      try { setCore(await coreRequest<CoreState>("state")); setError(""); }
      catch (cause) { if ((cause as {status?: number}).status === 401) { setCore(null); setError(""); } else setError(cause instanceof Error ? cause.message : "Connexion indisponible."); }
      finally { setLoading(false); refreshPromise.current = null; }
    })();
    refreshPromise.current = task;
    return task;
  }, []);
  useEffect(() => {
    if (auth.loading) return;
    if (!userId) {
      setCore(null);
      setLoading(false);
      return;
    }
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(onFocus, 3000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [auth.loading, userId, refresh]);
  return { core, loading, error, refresh, visitor: !core };
}
const AuthContext = createContext<ReturnType<typeof useCoreSession> | null>(null);
export function CoreAuthProvider({ children }: { children: ReactNode }) { const session = useCoreSession(); return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>; }
export function useCoreAuth() { const session = useContext(AuthContext); if (!session) throw new Error("CoreAuthProvider requis"); return session; }
