"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  Bot,
  Building2,
  Command,
  FileText,
  HelpCircle,
  Home,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Ticket,
  Upload,
  Users,
  Wallet,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCoreAuth } from "@/lib/client/core";
import { useProperty } from "@/lib/property";
import { useLiaison } from "@/lib/store";

interface ResultItem {
  id: string;
  section: "Tickets" | "Documents" | "Contacts" | "Pages";
  label: string;
  sub: string;
  href: string;
  icon: typeof Ticket;
  tone: string;
  propertyId?: string;
}

const pagesForRole = (role: "owner" | "tenant"): ResultItem[] => [
  { id: "page-home", section: "Pages", label: "Accueil", sub: "Tableau de bord du logement", href: "/", icon: Home, tone: "bg-cream-soft text-petrol" },
  { id: "page-tickets", section: "Pages", label: "Tickets", sub: "Tickets du logement actif", href: "/tickets", icon: Ticket, tone: "bg-sky-soft text-sky-dark" },
  { id: "page-conversations", section: "Pages", label: "Conversations", sub: "Échanges du logement actif", href: "/conversations", icon: MessageSquare, tone: "bg-sage-soft text-sage" },
  { id: "page-documents", section: "Pages", label: "Documents", sub: "Bail, quittances, devis", href: "/documents", icon: FileText, tone: "bg-peach-soft text-peach-dark" },
  { id: "page-loyer", section: "Pages", label: role === "owner" ? "Loyers" : "Loyer", sub: "Échéances et quittances", href: "/loyer", icon: Wallet, tone: "bg-sage-soft text-sage" },
  { id: "page-contrat", section: "Pages", label: "Bail", sub: "Bail et clauses", href: "/contrat", icon: FileText, tone: "bg-cream-soft text-petrol" },
  { id: "page-assistant", section: "Pages", label: "Assistant IA", sub: "Conseils en droit locatif", href: "/assistant", icon: Bot, tone: "bg-petrol text-white" },
  { id: "page-contacts", section: "Pages", label: "Interlocuteurs", sub: "Contacts et artisans", href: "/contacts", icon: Users, tone: "bg-sky-soft text-sky-dark" },
  { id: "page-parametres", section: "Pages", label: "Paramètres", sub: "Profil et préférences", href: "/parametres", icon: Settings, tone: "bg-cream-soft text-petrol" },
  { id: "page-notifications", section: "Pages", label: "Notifications", sub: "Journal d'activité", href: "/notifications", icon: Bell, tone: "bg-sky-soft text-sky-dark" },
  ...(role === "owner" ? [{ id: "page-bailleur", section: "Pages" as const, label: "Portefeuille", sub: "Tous vos logements", href: "/bailleur", icon: Building2, tone: "bg-petrol-soft text-petrol" }] : []),
  { id: "page-aide", section: "Pages", label: "Centre d'aide", sub: "FAQ et assistance", href: "/aide", icon: HelpCircle, tone: "bg-cream-soft text-petrol" },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SearchModal() {
  const router = useRouter();
  const { searchOpen, closeSearch, openNewTicket } = useUI();
  const { user } = useAuth();
  const { core } = useCoreAuth();
  const { activeProperty, scopedTickets: tickets, setActiveProperty } = useProperty();
  const { documents: allDocuments } = useLiaison();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    setQuery("");
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  const results = useMemo<ResultItem[]>(() => {
    const q = normalize(query.trim());
    const ticketResults: ResultItem[] = tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      section: "Tickets",
      label: `#${ticket.id} · ${ticket.shortTitle}`,
      sub: `${ticket.assignee} · ${ticket.badge}`,
      href: `/tickets/${ticket.id}`,
      icon: Ticket,
      tone: "bg-sky-soft text-sky-dark",
      propertyId: ticket.propertyId,
    }));
    const ticketIds = new Set(tickets.map((ticket) => ticket.id));
    const documentResults: ResultItem[] = allDocuments.filter((document) => !document.ticketId || ticketIds.has(document.ticketId)).map((document) => ({
      id: `document-${document.id}`,
      section: "Documents",
      label: document.name,
      sub: `${document.category} · ${document.size} · ${document.date}`,
      href: `/documents?doc=${document.id}`,
      icon: FileText,
      tone: "bg-peach-soft text-peach-dark",
    }));
    const propertyDocumentResults: ResultItem[] = (core?.property_documents || []).filter((document) => document.property_id === activeProperty?.id).map((document) => ({
      id: `property-document-${document.id}`,
      section: "Documents",
      label: document.name,
      sub: `Document du logement · ${Math.max(1, Math.ceil(document.size / 1024))} Ko`,
      href: `/documents?doc=property-${document.id}`,
      icon: FileText,
      tone: "bg-peach-soft text-peach-dark",
    }));
    const people = [
      activeProperty?.owner_name ? { id: "owner", name: activeProperty.owner_name, role: "Propriétaire" } : null,
      activeProperty?.tenant_name ? { id: "tenant", name: activeProperty.tenant_name, role: "Locataire" } : null,
    ].filter((person): person is { id: string; name: string; role: string } => Boolean(person && person.name !== user?.name));
    const contactResults: ResultItem[] = people.map((contact) => ({
      id: `contact-${contact.id}`,
      section: "Contacts",
      label: contact.name,
      sub: contact.role,
      href: `/contacts?contact=${contact.id}`,
      icon: Users,
      tone: "bg-sage-soft text-sage",
    }));

    const all = [...ticketResults, ...documentResults, ...propertyDocumentResults, ...contactResults, ...pagesForRole(user?.role ?? "tenant")];
    if (!q) return [];
    return all.filter((item) => normalize(`${item.label} ${item.sub}`).includes(q)).slice(0, 12);
  }, [activeProperty, allDocuments, core?.property_documents, query, tickets, user]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const grouped = useMemo(() => {
    const sections: ResultItem["section"][] = ["Tickets", "Documents", "Contacts", "Pages"];
    return sections
      .map((section) => ({ section, items: results.filter((item) => item.section === section) }))
      .filter((group) => group.items.length > 0);
  }, [results]);

  const flat = grouped.flatMap((group) => group.items);

  const go = (item: ResultItem) => {
    closeSearch();
    if (item.propertyId) setActiveProperty(item.propertyId);
    router.push(item.href);
  };

  const quickActions = [
    {
      label: user?.role === "owner" ? "Créer un ticket" : "Signaler un problème",
      sub: "Pour le logement actif",
      icon: Plus,
      action: () => {
        closeSearch();
        openNewTicket();
      },
    },
    {
      label: "Ajouter un document",
      sub: "Facture, devis, constat",
      icon: Upload,
      action: () => {
        closeSearch();
        router.push("/documents");
      },
    },
    {
      label: "Poser une question à l'assistant",
      sub: "Droit locatif",
      icon: Bot,
      action: () => {
        closeSearch();
        router.push("/assistant");
      },
    },
  ];

  return (
    <Modal
      open={searchOpen}
      onClose={closeSearch}
      className="max-w-[640px]"
      ariaLabel="Rechercher dans LIAISON"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Rechercher dans le logement actif"
            aria-expanded={Boolean(query.trim())}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={flat[active] ? `search-result-${flat[active].id}` : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, flat.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter" && flat[active]) {
                event.preventDefault();
                go(flat[active]);
              }
            }}
            placeholder="Rechercher un ticket, un document, une clause, un contact…"
            className="min-w-0 flex-1 bg-transparent py-1 text-[12px] text-ink outline-none placeholder:text-muted/70"
          />
          <span className="hidden items-center gap-0.5 rounded-md border border-line bg-cream-soft px-1.5 py-0.5 text-[8.5px] font-semibold text-muted sm:flex">
            ESC
          </span>
        </div>

        <div id="search-results" role={query.trim() ? "listbox" : undefined} aria-label="Résultats de recherche" className="max-h-[58vh] overflow-y-auto p-2.5">
          {query.trim() === "" ? (
            <>
              <div className="px-1.5 pb-1.5 pt-1">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-muted">
                  Actions rapides
                </p>
                <div className="mt-1.5 flex flex-col gap-1">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.action}
                      className="group flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-cream-soft"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cream-soft text-petrol group-hover:bg-white">
                        <action.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold text-ink">{action.label}</span>
                        <span className="text-[8px] text-muted">{action.sub}</span>
                      </span>
                      <ArrowUpRight className="h-3 w-3 text-muted/60" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2 border-t border-line/70 px-1.5 pt-2">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-muted">
                  Tickets récents
                </p>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {tickets.slice(0, 3).map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() =>
                        go({
                          id: ticket.id,
                          section: "Tickets",
                          label: ticket.shortTitle,
                          sub: "",
                          href: `/tickets/${ticket.id}`,
                          icon: Ticket,
                          tone: "",
                        })
                      }
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-cream-soft"
                    >
                      <span className="rounded bg-petrol px-1.5 py-0.5 text-[7.5px] font-bold text-white">
                        #{ticket.id.slice(0, 8)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[9.5px] font-semibold text-ink">
                        {ticket.shortTitle}
                      </span>
                      <span className="text-[8px] text-muted">{ticket.updatedAt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-soft text-muted">
                <Search className="h-4 w-4" />
              </span>
              <p className="mt-2 text-[11px] font-bold text-ink">Aucun résultat</p>
              <p className="mt-0.5 text-[9px] text-muted">
                Essayez « fuite », « loyer », « quittance » ou un nom du logement.
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.section} className="mb-1.5">
                <p className="px-1.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-muted">
                  {group.section}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const index = flat.findIndex((entry) => entry.id === item.id);
                    const isActive = index === active;
                    return (
                      <button
                        key={item.id}
                        id={`search-result-${item.id}`}
                        role="option"
                        aria-selected={isActive}
                        type="button"
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(item)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition",
                          isActive ? "bg-cream-soft" : "hover:bg-cream-soft/70",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                            item.tone,
                          )}
                        >
                          <item.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-semibold text-ink">
                            {item.label}
                          </span>
                          <span className="block truncate text-[8px] text-muted">{item.sub}</span>
                        </span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted/50" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line bg-cream-soft/60 px-4 py-2">
          <div className="flex items-center gap-2 text-[8px] text-muted">
            <span className="flex items-center gap-0.5">
              <Command className="h-2.5 w-2.5" />K
            </span>
            <span>pour rechercher</span>
            <span className="text-muted/50">·</span>
            <span>↑↓ pour naviguer</span>
            <span className="text-muted/50">·</span>
            <span>↵ pour ouvrir</span>
          </div>
          <span className="flex items-center gap-1 text-[7.5px] font-semibold text-sage">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            Index local
          </span>
        </div>
      </div>
    </Modal>
  );
}
