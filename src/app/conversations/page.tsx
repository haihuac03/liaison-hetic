"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCheck,
  FileText,
  Handshake,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Chat from "@/components/chat/Chat";
import Avatar from "@/components/ui/Avatar";
import TicketStatus from "@/components/ui/TicketStatus";
import { STATUS_META } from "@/lib/meta";
import { useAuth, type AuthProperty } from "@/lib/auth";
import { useProperty } from "@/lib/property";
import { useUI } from "@/lib/ui";
import type { Contact, Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rowStatus, rowsFor } from "@/components/tickets/workflow";

type ThreadFilter = "toutes" | "interventions" | "litiges" | "cloturees";

const FILTERS: { id: ThreadFilter; label: string }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "interventions", label: "Interventions" },
  { id: "litiges", label: "Litiges" },
  { id: "cloturees", label: "Clôturées" },
];

function propertyParticipants(property: AuthProperty | null): Contact[] {
  if (!property) return [];
  const people: (Contact | null)[] = [
    property.owner_name ? {
      id: "owner",
      name: property.owner_name,
      role: "Propriétaire",
      subtitle: "Partie du bail",
      initials: property.owner_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      color: "petrol" as const,
    } : null,
    property.tenant_name ? {
      id: "tenant",
      name: property.tenant_name,
      role: "Locataire",
      subtitle: "Partie du bail",
      initials: property.tenant_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      color: "sage" as const,
    } : null,
  ];
  return people.filter((person): person is Contact => person !== null);
}

function lastVisibleMessage(ticket: Ticket) {
  return (
    [...ticket.messages].reverse().find((message) => !message.system) ??
    ticket.messages[ticket.messages.length - 1]
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function ConversationsPage() {
  const { user } = useAuth();
  const { activeProperty, scopedTickets: tickets, setActiveProperty } = useProperty();
  const { openNewTicket, showToast } = useUI();
  const [selectedId, setSelectedId] = useState("");
  const [panelContactId, setPanelContactId] = useState("owner");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ThreadFilter>("toutes");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const contactId = params.get("contact");
    if (!contactId) return;
    setPanelContactId(contactId);
  }, []);

  useEffect(() => {
    if (!tickets.some((ticket) => ticket.id === selectedId) && tickets[0]) {
      setSelectedId(tickets[0].id);
    }
  }, [selectedId, tickets]);

  useEffect(() => {
    if (!tickets.some((ticket) => ticket.id === selectedId)) setSelectedId("");
  }, [selectedId, tickets]);

  const threads = useMemo(() => {
    const q = normalize(query.trim());
    return tickets.filter((ticket) => {
      const matchesFilter =
        filter === "toutes" ||
        (filter === "interventions" && rowsFor(ticket, "interventions").length > 0) ||
        (filter === "litiges" && rowsFor(ticket, "disputes").some((row) => rowStatus(row) === "open")) ||
        (filter === "cloturees" && ["resolu", "ferme"].includes(ticket.status));
      if (!matchesFilter) return false;
      if (!q) return true;
      const last = lastVisibleMessage(ticket);
      return normalize(
        `${ticket.id} ${ticket.title} ${ticket.assignee} ${last?.text ?? ""}`,
      ).includes(q);
    });
  }, [filter, query, tickets]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0];
  const participants = propertyParticipants(activeProperty);
  const panelContact = participants.find((contact) => contact.id === panelContactId) ?? participants[0] ?? {
    id: "participant",
    name: "Interlocuteur non renseigné",
    role: "Partie du logement",
    subtitle: "",
    initials: "?",
    color: "neutral" as const,
  };

  const totalMessages = tickets.reduce((sum, ticket) => sum + ticket.messages.length, 0);
  const activeThreads = tickets.filter(
    (ticket) => !["resolu", "ferme"].includes(ticket.status),
  ).length;
  const agreements = tickets.reduce((total, ticket) => total + rowsFor(ticket, "agreements").length, 0);

  const stats = [
    {
      label: "Conversations actives",
      value: String(activeThreads).padStart(2, "0"),
      helper: "Tickets en cours",
      icon: MessageSquare,
      tone: "bg-sage-soft text-sage",
    },
    {
      label: "Messages échangés",
      value: String(totalMessages).padStart(2, "0"),
      helper: "Horodatés & archivés",
      icon: CheckCheck,
      tone: "bg-sky-soft text-sky-dark",
    },
    {
      label: "Participants",
      value: String(participants.length).padStart(2, "0"),
      helper: `${participants.length} partie${participants.length > 1 ? "s" : ""} du bail`,
      icon: Sparkles,
      tone: "bg-peach-soft text-peach-dark",
    },
    {
      label: "Accords conclus",
      value: String(agreements).padStart(2, "0"),
      helper: "Accords enregistrés",
      icon: Handshake,
      tone: "bg-cream-soft text-petrol",
    },
  ];

  const selectThread = (ticket: Ticket) => {
    setSelectedId(ticket.id);
    setPanelContactId(user?.role === "owner" ? "tenant" : "owner");
  };

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Logement actif
              <span className="text-muted/50">·</span>
              <span className="font-medium normal-case tracking-normal text-muted">
                {activeProperty?.address || "Aucun logement sélectionné"}
              </span>
            </p>
            <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
              Conversations
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Retrouvez les échanges de ce logement, réunis par ticket et conservés dans cet espace.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href="/contrat" className="btn-soft h-10">
              <FileText className="h-4 w-4 text-sage" />
              Voir les documents
            </Link>
            <button
              type="button"
              onClick={() => openNewTicket("desaccord")}
              className="btn-dark h-10"
            >
              <Plus className="h-4 w-4" />
              Ouvrir une discussion
            </button>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card flex items-start gap-3 p-3.5">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  stat.tone,
                )}
              >
                <stat.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-muted">
                  {stat.label}
                </p>
                <p className="mt-0.5 truncate font-headline text-[22px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                  {stat.value}
                </p>
                <p className="mt-1 truncate text-[8.5px] text-muted">{stat.helper}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-[292px_minmax(0,1fr)_284px]">
          <aside className="card flex h-[680px] flex-col overflow-hidden">
            <div className="shrink-0 border-b border-line/80 p-2.5">
              <div className="flex h-9 items-center gap-2 rounded-xl border border-line bg-cream-soft px-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher un échange…"
                  className="min-w-0 flex-1 bg-transparent text-[10px] text-ink outline-none placeholder:text-muted/70"
                />
              </div>
              <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      "h-7 shrink-0 rounded-full px-2.5 text-[9px] font-semibold transition",
                      filter === item.id
                        ? "bg-petrol text-white"
                        : "border border-line bg-white text-muted hover:text-ink",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5">
              {threads.length === 0 ? (
                <div className="flex flex-col items-center px-4 py-12 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-soft text-muted">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                  <p className="mt-2 text-[11px] font-bold text-ink">Aucune conversation</p>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
                    Modifiez votre recherche ou ouvrez un nouveau ticket.
                  </p>
                </div>
              ) : (
                threads.map((ticket) => {
                  const active = ticket.id === selected?.id;
                  const last = lastVisibleMessage(ticket);
                  const status = STATUS_META[ticket.status];
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => selectThread(ticket)}
                      className={cn(
                        "relative mb-1 flex w-full flex-col rounded-xl px-2.5 py-2.5 text-left transition",
                        active
                          ? "bg-cream-soft shadow-[inset_0_0_0_1px_rgba(231,230,223,0.9)]"
                          : "hover:bg-cream-soft/60",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-2.5 left-0 w-[2px] rounded-full",
                          active ? status.accent : "bg-transparent",
                        )}
                      />
                      <div className="flex items-center gap-1.5 pl-1">
                        <span className="rounded bg-petrol px-1.5 py-0.5 text-[7.5px] font-bold text-white">
                          #{ticket.id.slice(0, 8)}
                        </span>
                        <span className={cn("chip", status.chip)}>
                          <span className={cn("h-1 w-1 rounded-full", status.dot)} />
                          {status.label}
                        </span>
                        <span className="ml-auto text-[8px] text-muted">
                          {last?.time ?? ticket.updatedAt}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate pl-1 text-[10.5px] font-bold text-ink">
                        {ticket.shortTitle}
                      </p>
                      <p className="mt-0.5 line-clamp-2 pl-1 text-[9px] leading-relaxed text-muted">
                        {last?.authorName ? `${last.authorName.split(" ")[0]} : ` : ""}
                        {last?.text}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5 pl-1 text-[8px] font-medium text-muted">
                        <Users className="h-2.5 w-2.5" />
                        {ticket.assignee}
                        {ticket.unread ? (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-petrol px-1 text-[7.5px] font-bold text-white">
                            {ticket.unread}
                          </span>
                        ) : (
                          <CheckCheck className="ml-auto h-2.5 w-2.5 text-sage" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-line/80 p-2.5">
              <button
                type="button"
                onClick={() => {
                  openNewTicket("autre");
                  showToast(
                    "Nouvelle conversation",
                    "Choisissez le motif : le ticket sera rattaché à vos échanges.",
                    "info",
                  );
                }}
                className="btn-soft h-8 w-full text-[9.5px]"
              >
                <Plus className="h-3 w-3" />
                Nouvelle conversation
              </button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-3">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-white/60 px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-cream-soft text-petrol">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-bold text-ink">
                        Ticket #{selected.id.slice(0, 8)} · {selected.shortTitle}
                      </p>
                      <p className="truncate text-[8.5px] text-muted">
                        {selected.messages.length} messages · {selected.documents.length} pièces
                        jointes
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/tickets/${selected.id}`}
                    onClick={() => selected.propertyId && setActiveProperty(selected.propertyId)}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-cream-soft px-2.5 text-[8.5px] font-bold text-ink transition hover:bg-petrol hover:text-white"
                  >
                    Ouvrir le ticket
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                <Chat ticket={selected} />
              </>
            ) : (
              <div className="card flex h-[680px] flex-col items-center justify-center p-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-soft text-muted">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <p className="mt-3 font-headline text-[15px] font-bold text-ink">
                  Sélectionnez une conversation
                </p>
                <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-muted">
                  Vos échanges apparaîtront ici, rattachés au ticket concerné.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <section className="card p-4">
              <div className="flex items-start gap-2.5">
                <Avatar
                  src={panelContact.avatar}
                  initials={panelContact.initials}
                  size="lg"
                  tone={panelContact.color}
                  online={panelContact.online}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="truncate font-headline text-[13px] font-bold text-ink">
                      {panelContact.name}
                    </h2>
                    {panelContact.tag && (
                      <span className="chip bg-cream-soft text-[#5F686B]">{panelContact.tag}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[9px] leading-relaxed text-muted">
                    {panelContact.role}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[8px] text-muted">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        panelContact.online ? "bg-sage" : "bg-[#B7BCBD]",
                      )}
                    />
                    {panelContact.online ? "En ligne maintenant" : `Dernier contact ${panelContact.lastContact ?? "—"}`}
                  </p>
                </div>
              </div>

              <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-sage-soft/60 px-2.5 py-2 text-[8px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-2.5 w-2.5 shrink-0 text-sage" />
                Les échanges restent visibles par les parties rattachées à ce logement.
              </p>
            </section>

            {selected && (
              <section className="card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-cream-soft text-petrol">
                      <Wrench className="h-3.5 w-3.5" />
                    </span>
                    <h2 className="text-[10.5px] font-bold text-ink">Ticket lié</h2>
                  </div>
                  <TicketStatus status={selected.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-[10px] font-bold leading-snug text-ink">
                  {selected.title}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-cream-soft px-2.5 py-2 text-[8px] text-muted"><span>{selected.badge}</span><span>Dernière activité : {selected.updatedAt}</span></div>
                <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-cream-soft px-2.5 py-2 text-[8px] text-muted">
                  <FileText className="h-2.5 w-2.5 shrink-0" />
                  {selected.documents.length} pièce(s) jointe(s)
                  <span className="ml-auto font-semibold text-ink">{selected.assignee}</span>
                </div>
                <Link
                  href={`/tickets/${selected.id}`}
                  onClick={() => selected.propertyId && setActiveProperty(selected.propertyId)}
                  className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-petrol text-[8.5px] font-bold text-white transition hover:bg-petrol-dark"
                >
                  Suivre le ticket
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </section>
            )}

            <section className="card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[10.5px] font-bold text-ink">Interlocuteurs</h2>
                <Link
                  href="/contacts"
                  className="text-[8px] font-semibold text-sage hover:underline"
                >
                  Tout voir
                </Link>
              </div>
              <div className="mt-2 flex flex-col gap-0.5">
                {participants.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setPanelContactId(contact.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition",
                      contact.id === panelContact.id
                        ? "bg-cream-soft"
                        : "hover:bg-cream-soft/60",
                    )}
                  >
                    <Avatar
                      src={contact.avatar}
                      initials={contact.initials}
                      size="sm"
                      tone={contact.color}
                      online={contact.online}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9.5px] font-semibold text-ink">
                        {contact.name}
                      </span>
                      <span className="block truncate text-[8px] text-muted">{contact.role}</span>
                    </span>
                    {contact.id === panelContact.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-card border border-petrol/10 bg-petrol p-3.5 text-white shadow-soft">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-mint" />
                <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/60">
                  Réflexe LIAISON
                </p>
              </div>
              <p className="mt-1.5 text-[9.5px] font-semibold leading-relaxed">
                Un désaccord ? Décrivez les faits sans interprétation et proposez une solution
                chiffrée : un message factuel accélère la médiation.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-white/45 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] font-medium text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            {totalMessages} messages horodatés · archive 10 ans · accès limité aux parties du bail
          </p>
          <Link
            href="/aide"
            className="flex items-center gap-1 text-[9px] font-semibold text-muted transition hover:text-sage"
          >
            Comment fonctionne la médiation ?
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
