"use client";

import { useMemo, useState } from "react";
import { ChevronDown, FileStack, Filter, Handshake, LayoutGrid, LayoutList, Plus, Search, ShieldAlert, Ticket as TicketIcon, Wrench } from "lucide-react";
import AppShell from "@/components/AppShell";
import TicketCard from "@/components/tickets/TicketCard";
import { useCoreAuth } from "@/lib/client/core";
import { useAuth } from "@/lib/auth";
import { useProperty } from "@/lib/property";
import { useUI } from "@/lib/ui";
import type { TicketStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rowsFor, ticketTimestamp } from "@/components/tickets/workflow";

type FilterKey = "all" | TicketStatus;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "en_cours", label: "En cours" },
  { key: "en_attente", label: "En attente" },
  { key: "en_litige", label: "En litige" },
  { key: "en_cloture", label: "Clôture à confirmer" },
  { key: "ferme", label: "Fermés" },
];

export default function TicketsPage() {
  const { user } = useAuth();
  const { activeProperty, scopedTickets: tickets, setActiveProperty } = useProperty();
  const { core } = useCoreAuth();
  const { openNewTicket } = useUI();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"list" | "grid">("list");
  const canCreate = Boolean(activeProperty && (user?.role === "tenant" || activeProperty.tenant_id));
  const ticketIds = useMemo(() => new Set(tickets.map((ticket) => ticket.id)), [tickets]);

  const stats = useMemo(() => ({
    total: tickets.length,
    active: tickets.filter((ticket) => !["ferme", "resolu"].includes(ticket.status)).length,
    intervention: tickets.filter((ticket) => rowsFor(ticket, "interventions").some((row) => ["proposed", "accepted", "awaiting_confirmation", "contested"].includes(String(row.status || "")))).length,
    disputes: core?.disputes?.filter((row) => row.status === "open" && ticketIds.has(row.ticket_id)).length || 0,
    agreements: core?.agreements?.filter((row) => ticketIds.has(row.ticket_id)).length || 0,
  }), [tickets, core?.disputes, core?.agreements, ticketIds]);

  const filtered = useMemo(() => {
    const matches = tickets.filter((ticket) => {
      const q = query.trim().toLowerCase();
      const searchable = !q || ticket.title.toLowerCase().includes(q) || ticket.description.toLowerCase().includes(q) || ticket.id.includes(q) || ticket.assignee.toLowerCase().includes(q);
      return (filter === "all" || ticket.status === filter) && searchable;
    });
    return [...matches].sort((a, b) => {
      if (sort === "oldest") return ticketTimestamp(a, "created") - ticketTimestamp(b, "created");
      if (sort === "status") return a.status.localeCompare(b.status);
      if (sort === "title") return a.title.localeCompare(b.title);
      return ticketTimestamp(b, "updated") - ticketTimestamp(a, "updated");
    });
  }, [tickets, filter, query, sort]);

  const counts = (key: FilterKey) => key === "all" ? tickets.length : tickets.filter((ticket) => ticket.status === key).length;
  const statCards = [
    { label: "Tous les dossiers", value: stats.total, note: "Visibles pour ce compte", icon: FileStack, tile: "bg-cream-soft text-petrol" },
    { label: "Dossiers actifs", value: stats.active, note: "Non fermés", icon: Wrench, tile: "bg-peach-soft text-peach-dark" },
    { label: "Interventions suivies", value: stats.intervention, note: "Action actuellement ouverte", icon: Handshake, tile: "bg-sky-soft text-sky-dark" },
    { label: "Litiges ouverts", value: stats.disputes, note: `${stats.agreements} accord${stats.agreements > 1 ? "s" : ""} enregistré${stats.agreements > 1 ? "s" : ""}`, icon: ShieldAlert, tile: "bg-peach-soft text-peach-dark" },
  ];

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="eyebrow flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sage" />Dossiers du logement actif</p><h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">Dossiers</h1><p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">Retrouvez les dossiers, interventions et décisions de {activeProperty?.address || "votre logement actif"}.</p></div>
          {canCreate && <button type="button" onClick={() => openNewTicket()} className="btn-dark h-10 shrink-0 px-4"><Plus className="h-4 w-4" strokeWidth={2.2} />Nouveau ticket</button>}
        </header>

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">{statCards.map((stat) => <div key={stat.label} className="card flex items-start gap-3 p-3.5"><div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stat.tile)}><stat.icon className="h-[18px] w-[18px]" /></div><div className="min-w-0"><p className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-muted">{stat.label}</p><p className="mt-0.5 font-headline text-[25px] font-extrabold leading-none tracking-[-0.03em] text-ink">{stat.value}</p><p className="mt-1 line-clamp-1 text-[8.5px] text-muted">{stat.note}</p></div></div>)}</div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5"><span className="mr-1 hidden items-center gap-1 text-[9px] font-semibold text-muted sm:flex"><Filter className="h-3 w-3" />Filtrer</span>{FILTERS.map((item) => { const active = filter === item.key; return <button key={item.key} type="button" onClick={() => setFilter(item.key)} aria-pressed={active} className={cn("flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[9.5px] font-semibold transition", active ? "bg-petrol text-white" : "border border-line bg-white/70 text-muted hover:border-petrol/20 hover:text-ink")}>{item.label}<span className={cn("text-[8px]", active ? "text-white/55" : "text-muted/60")}>{counts(item.key)}</span></button>; })}</div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="card flex h-10 flex-1 items-center gap-2 px-3.5 shadow-none"><Search className="h-4 w-4 shrink-0 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher par titre, description ou référence…" className="min-w-0 flex-1 bg-transparent text-[10.5px] text-ink outline-none placeholder:text-muted/70" /></div>
          <div className="flex items-center gap-1.5"><div className="relative"><select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 appearance-none rounded-xl border border-line bg-white pl-3 pr-8 text-[9.5px] font-semibold text-ink outline-none shadow-soft" aria-label="Trier les tickets"><option value="recent">Dernière activité</option><option value="oldest">Plus anciens</option><option value="status">Statut</option><option value="title">Titre</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" /></div><div className="flex h-10 items-center rounded-xl border border-line bg-white p-1 shadow-soft"><button type="button" onClick={() => setView("list")} className={cn("flex h-7 w-7 items-center justify-center rounded-lg", view === "list" ? "bg-cream-soft text-ink" : "text-muted")} aria-label="Vue liste"><LayoutList className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setView("grid")} className={cn("flex h-7 w-7 items-center justify-center rounded-lg", view === "grid" ? "bg-cream-soft text-ink" : "text-muted")} aria-label="Vue grille"><LayoutGrid className="h-3.5 w-3.5" /></button></div></div>
        </div>

        <div className="mt-3 grid gap-3.5 xl:grid-cols-[1.7fr_1fr]">
          <div>
            {filtered.length === 0 ? <div className="card flex flex-col items-center justify-center px-6 py-16 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-soft text-muted"><TicketIcon className="h-5 w-5" /></div><h2 className="mt-3 font-headline text-[16px] font-bold text-ink">Aucun dossier trouvé</h2><p className="mt-1 max-w-xs text-[10.5px] leading-relaxed text-muted">Modifiez les filtres ou ouvrez un dossier pour ce logement.</p>{canCreate && <button type="button" onClick={() => openNewTicket()} className="btn-dark mt-3 h-9 px-4 text-[10px]"><Plus className="h-3.5 w-3.5" />{user?.role === "owner" ? "Créer un dossier" : "Signaler un problème"}</button>}</div> : <div className={cn("grid gap-2.5", view === "grid" && "md:grid-cols-2")} onClickCapture={() => activeProperty && setActiveProperty(activeProperty.id)}>{filtered.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} compact={view === "grid"} />)}</div>}
            <div className="mt-3 rounded-xl border border-line/70 bg-white/45 px-3.5 py-2.5 text-[9px] leading-relaxed text-muted">La chronologie de chaque dossier provient de ses événements enregistrés.</div>
          </div>
          <aside className="flex flex-col gap-3">
            <section className="card p-4">
              <p className="eyebrow">Dossier actif</p>
              <h2 className="mt-2 font-headline text-[16px] font-bold text-ink">{activeProperty?.address || "Aucun logement actif"}</h2>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{tickets.length} dossier{tickets.length > 1 ? "s" : ""} dans ce logement.</p>
              {canCreate ? <button type="button" onClick={() => openNewTicket()} className="btn-dark mt-3 h-9 w-full text-[10px]"><Plus className="h-3.5 w-3.5" />{user?.role === "owner" ? "Créer un dossier" : "Signaler un problème"}</button> : <p className="mt-3 rounded-xl bg-cream-soft p-3 text-[9px] leading-relaxed text-muted">Ce logement doit être relié à un locataire pour ouvrir un dossier partagé.</p>}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
