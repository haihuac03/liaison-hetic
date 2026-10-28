"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { coreRequest, type CoreEvent } from "@/lib/client/core";
import type { Ticket } from "@/lib/types";
import { formatWorkflowDate } from "./workflow";

type EventRow = Partial<CoreEvent> & Record<string, unknown>;

const LABELS: Record<string, string> = {
  "ticket.created": "Ticket créé",
  "ticket.status": "Statut modifié",
  "ticket.status_changed": "Statut modifié",
  "ticket.reopened": "Ticket réouvert",
  "message.created": "Message ajouté",
  "file.uploaded": "Pièce jointe ajoutée",
  "intervention.proposed": "Intervention proposée",
  "intervention.accepted": "Intervention acceptée",
  "intervention.refused": "Intervention refusée",
  "intervention.completed": "Réalisation déclarée",
  "intervention.confirmed": "Réalisation confirmée",
  "intervention.contested": "Réalisation contestée",
  "closure.requested": "Clôture demandée",
  "closure.accepted": "Clôture acceptée",
  "closure.refused": "Clôture refusée",
  "dispute.opened": "Litige ouvert",
  "dispute.withdrawn": "Litige retiré",
};

const eventValue = (event: EventRow, ...keys: string[]) => {
  for (const key of keys) {
    const value = event[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const actionLabel = (value: string) => {
  if (LABELS[value]) return LABELS[value];
  return value ? value.replace(/[._-]+/g, " ") : "Action enregistrée";
};

const payloadDetail = (event: EventRow) => {
  const payload = eventValue(event, "payload", "metadata");
  if (!payload || typeof payload !== "object") return "";
  const row = payload as Record<string, unknown>;
  const parts = [row.subject, row.reason, row.summary, row.description, row.status]
    .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
    .map(String)
    .filter(Boolean);
  return parts.slice(0, 2).join(" · ");
};

const payloadFileIds = (event: EventRow): string[] => {
  const payload = eventValue(event, "payload");
  if (!payload || typeof payload !== "object") return [];
  const value = (payload as Record<string, unknown>).fileIds;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

function eventList(response: unknown): { events: EventRow[]; hasMore: boolean; nextSeq: number } {
  const object = response && typeof response === "object" ? response as Record<string, unknown> : {};
  const source = Array.isArray(response) ? response : Array.isArray(object.events) ? object.events : Array.isArray(object.items) ? object.items : [];
  const events = source.filter((item): item is EventRow => Boolean(item) && typeof item === "object");
  const nextSeq = events.reduce((max, event) => Math.max(max, Number(eventValue(event, "seq", "sequence") || 0)), 0);
  return { events, hasMore: Boolean(object.has_more ?? object.hasMore), nextSeq };
}

export default function TicketTimeline({ ticket }: { ticket: Ticket }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [afterSeq, setAfterSeq] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (append = false) => {
    setLoading(true);
    setError("");
    try {
      const cursor = append ? afterSeq : 0;
      const response = await coreRequest<unknown>(`events/${encodeURIComponent(ticket.id)}?afterSeq=${cursor}&limit=50`);
      const result = eventList(response);
      setEvents((current) => append ? [...current, ...result.events] : result.events);
      setAfterSeq((current) => append ? Math.max(current, result.nextSeq) : result.nextSeq);
      setHasMore(result.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L’historique est indisponible.");
    } finally {
      setLoading(false);
    }
  }, [afterSeq, ticket.id]);

  useEffect(() => {
    setEvents([]);
    setAfterSeq(0);
    setHasMore(false);
    void load(false);
    // The timestamps and version change after every persisted workflow action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id, ticket.updatedTimestamp, ticket.version, ticket.status, ticket.messages.length]);

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="flex items-center gap-1.5 font-headline text-[14px] font-bold leading-tight tracking-[-0.02em] text-ink"><History className="h-3.5 w-3.5 text-petrol" /> Historique</h2><p className="mt-1 text-[8.5px] text-muted">Événements enregistrés dans le ticket</p></div>
        <button type="button" onClick={() => void load(false)} disabled={loading} className="icon-btn h-7 w-7 rounded-lg" aria-label="Actualiser l’historique"><RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-peach-soft px-2.5 py-2 text-[8.5px] text-peach-dark">{error}</p>}
      {!loading && !error && events.length === 0 && <p className="mt-3 rounded-lg bg-cream-soft px-3 py-4 text-center text-[8.5px] text-muted">Aucun événement enregistré.</p>}
      <ol className="mt-3">
        {events.map((event, index) => {
          const action = String(eventValue(event, "type", "event_type", "action") || "");
          const actor = String(eventValue(event, "actor_name", "actorName", "actor_role", "actor_id") || "Système");
          const date = eventValue(event, "created_at", "createdAt", "occurred_at");
          const detail = payloadDetail(event);
          const fileIds = payloadFileIds(event);
          const last = index === events.length - 1;
          return (
            <li key={String(eventValue(event, "id", "seq") || index)} className="relative flex gap-2.5 pb-3 last:pb-0">
              {!last && <span className="absolute left-[7px] top-[17px] h-[calc(100%-12px)] w-px bg-sage/25" />}
              <span className="relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-white bg-sage shadow-[0_0_0_1px_rgba(94,126,107,0.16)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2"><p className="text-[9.5px] font-bold leading-snug text-ink">{actionLabel(action)}</p><time className="shrink-0 text-[7.5px] font-medium text-muted">{formatWorkflowDate(date)}</time></div>
                <p className="mt-0.5 text-[8px] font-semibold text-sage-dark">{actor}</p>
                {detail && <p className="mt-0.5 line-clamp-2 text-[8px] leading-relaxed text-muted">{detail}</p>}
                {fileIds.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{fileIds.map((fileId) => { const document = ticket.documents.find((item) => item.id === fileId); return <a key={fileId} href={document?.preview || `/api/core/file/${fileId}`} target="_blank" rel="noreferrer" className="rounded bg-cream-soft px-1.5 py-1 text-[7.5px] font-semibold text-muted hover:text-sage">{document?.name || `Pièce ${fileId.slice(0, 8)}`}</a>; })}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      {hasMore && <button type="button" onClick={() => void load(true)} disabled={loading} className="mt-2 w-full rounded-lg bg-cream-soft py-1.5 text-[8px] font-semibold text-muted hover:text-ink">{loading ? "Chargement…" : "Afficher la suite"}</button>}
    </section>
  );
}
