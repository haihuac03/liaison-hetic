"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, FileText, MessageSquare, Paperclip, UserRound } from "lucide-react";
import { CATEGORY_META, STATUS_META } from "@/lib/meta";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCents, formatWorkflowDate, rowNumber, rowStatus, rowText, rowsFor } from "./workflow";

export default function TicketCard({ ticket, compact = false }: { ticket: Ticket; compact?: boolean }) {
  const status = STATUS_META[ticket.status] || STATUS_META.ouvert;
  const category = CATEGORY_META[ticket.category];
  const CategoryIcon = category.icon;
  const interventions = rowsFor(ticket, "interventions");
  const closures = rowsFor(ticket, "closures");
  const disputes = rowsFor(ticket, "disputes");
  const latestIntervention = [...interventions].sort((a, b) => (rowNumber(b, "created_at", "createdAt") || 0) - (rowNumber(a, "created_at", "createdAt") || 0))[0];
  const latestClosure = [...closures].sort((a, b) => (rowNumber(b, "created_at", "createdAt") || 0) - (rowNumber(a, "created_at", "createdAt") || 0))[0];
  const latestDispute = [...disputes].sort((a, b) => (rowNumber(b, "created_at", "createdAt") || 0) - (rowNumber(a, "created_at", "createdAt") || 0))[0];
  const photos = ticket.documents.filter((document) => document.type === "image").length || ticket.photos.length;
  const pdfs = ticket.documents.filter((document) => document.type === "pdf").length;

  return (
    <article className="group relative overflow-hidden rounded-card border border-line bg-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", status.accent)} />
      <div className={cn("p-4 pl-5 sm:p-[18px] sm:pl-6", compact && "p-3.5 pl-4")}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-petrol px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide text-white">#{ticket.id.slice(0, 8)}</span>
          <span className={cn("chip", status.chip)}><span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />{status.label}</span>
          <span className="chip bg-cream-soft text-[#5F686B]"><CategoryIcon className="h-2.5 w-2.5" />{category.label}</span>
          <span className="ml-auto flex items-center gap-1 text-[8.5px] font-medium text-muted"><MessageSquare className="h-2.5 w-2.5" />{ticket.messages.length} message{ticket.messages.length > 1 ? "s" : ""}</span>
        </div>
        <Link href={`/tickets/${ticket.id}`} className="mt-2.5 block"><h3 className="font-headline text-[16px] font-bold leading-snug tracking-[-0.02em] text-ink transition group-hover:text-petrol">{ticket.title}</h3></Link>
        {!compact && <p className="mt-1.5 line-clamp-2 max-w-[95%] text-[10.5px] leading-relaxed text-muted">{ticket.description}</p>}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/80 bg-cream-soft px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-sage"><UserRound className="h-3 w-3" /></span><div className="min-w-0"><p className="text-[7.5px] font-semibold uppercase tracking-wide text-muted">{ticket.correspondentRole || "Interlocuteur"}</p><p className="truncate text-[9px] font-bold text-ink">{ticket.assignee}</p></div></div>
          <p className="flex items-center gap-1 text-[8px] text-muted"><CalendarDays className="h-2.5 w-2.5" />Créé le {formatWorkflowDate(ticket.createdTimestamp, false)}</p>
        </div>

        {latestClosure && ["pending", "open", "en_attente"].includes(rowStatus(latestClosure)) && <p className="mt-2 rounded-lg bg-sky-soft px-2.5 py-2 text-[8.5px] font-medium text-sky-dark">Clôture demandée : {rowText(latestClosure, "subject") || ticket.title}</p>}
        {latestDispute && rowStatus(latestDispute) === "open" && <p className="mt-2 rounded-lg bg-peach-soft px-2.5 py-2 text-[8.5px] font-medium text-peach-dark">Litige ouvert : {rowText(latestDispute, "description")}</p>}
        {latestIntervention && !latestClosure && <div className="mt-2 rounded-lg bg-white px-2.5 py-2 text-[8.5px] text-muted"><span className="font-semibold text-ink">{rowText(latestIntervention, "artisan_name", "artisan")}</span> · {rowStatus(latestIntervention) === "proposed" ? "proposition à examiner" : rowStatus(latestIntervention) === "awaiting_confirmation" ? "réalisation à confirmer" : rowStatus(latestIntervention) || "intervention enregistrée"} · {formatCents(rowNumber(latestIntervention, "price_cents", "priceCents"))}</div>}

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[8.5px] font-medium text-muted"><span className="flex items-center gap-1"><FileText className="h-2.5 w-2.5" />{photos} photo{photos > 1 ? "s" : ""}</span><span className="flex items-center gap-1"><Paperclip className="h-2.5 w-2.5" />{pdfs} document{pdfs > 1 ? "s" : ""}</span></p>
          <Link href={`/tickets/${ticket.id}`} className="group/btn flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-cream-soft px-3 text-[9.5px] font-bold text-ink transition hover:bg-petrol hover:text-white">{ticket.status === "ferme" ? "Voir l’accord et l’historique" : "Ouvrir le ticket"}<ChevronRight className="h-3 w-3 transition group-hover/btn:translate-x-0.5" /></Link>
        </div>
      </div>
    </article>
  );
}
