"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Droplets,
  Flame,
  LifeBuoy,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ContactCard from "@/components/dashboard/ContactCard";
import Modal from "@/components/ui/Modal";
import { CONTACTS } from "@/lib/data";
import { useUI } from "@/lib/ui";
import { useAuth } from "@/lib/auth";
import { useProperty } from "@/lib/property";
import type { Contact } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const contactStorageKey = (userId?: string, propertyId?: string | null) => userId && propertyId ? `liaison-contacts-v5:${userId}:${propertyId}` : "";

const FILTERS = ["Tous", "Bailleur", "Artisans", "Syndic", "Support"] as const;
type ContactFilter = (typeof FILTERS)[number];

const ROLE_OPTIONS = [
  "Propriétaire bailleur",
  "Artisan plombier",
  "Artisan menuisier",
  "Artisan électricien",
  "Gestionnaire d'immeuble & syndic",
  "Support & médiation",
];

const EMERGENCY = [
  {
    label: "Urgence plomberie",
    name: "Plomberie Martin",
    phone: "+33 1 48 72 19 04",
    detail: "Fuite, infiltration, siphon",
    icon: Droplets,
    tone: "bg-sky-soft text-sky-dark",
  },
  {
    label: "Urgence électrique",
    name: "EDF Dépannage",
    phone: "09 72 67 50 75",
    detail: "Panne, disjoncteur, tableau",
    icon: Zap,
    tone: "bg-peach-soft text-peach-dark",
  },
  {
    label: "Urgence gaz",
    name: "GRDF Urgence",
    phone: "0 800 47 33 33",
    detail: "Odeur, fuite, chauffage",
    icon: Flame,
    tone: "bg-[#F9E8E4] text-[#A34A38]",
  },

];

function groupOf(contact: Contact): ContactFilter {
  if (contact.id === "claire" || /bailleur|propriétaire/i.test(contact.role)) return "Bailleur";
  if (contact.id === "agence" || /syndic|immeuble/i.test(contact.role)) return "Syndic";
  if (contact.id === "support" || /support|médiation/i.test(contact.role)) return "Support";
  if (/artisan|menuisier|plomb|électric/i.test(contact.role)) return "Artisans";
  return "Tous";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function ContactsPage() {
  const { showToast, openNewTicket } = useUI();
  const { user } = useAuth();
  const { activeProperty } = useProperty();
  const contactsKey = contactStorageKey(user?.id, activeProperty?.id);
  const [customContacts, setCustomContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("Tous");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    role: ROLE_OPTIONS[1],
    email: "",
    phone: "",
    subtitle: "",
  });

  useEffect(() => {
    try {
      if (!contactsKey) { setCustomContacts([]); return; }
      const raw = window.localStorage.getItem(contactsKey);
      if (raw) setCustomContacts(JSON.parse(raw) as Contact[]);
    } catch {
      // Ignore a corrupted local address book.
    }
  }, [contactsKey]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("contact");
    if (!id) return;
    setHighlight(id);
    const timer = window.setTimeout(() => {
      document.getElementById(`contact-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, []);

  const contacts = useMemo(() => {
    const participants: Contact[] = [];
    if (activeProperty?.owner_name) participants.push({ id: "active-owner", name: activeProperty.owner_name, role: "Propriétaire", subtitle: activeProperty.address, initials: activeProperty.owner_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: "petrol", tag: "Propriétaire" });
    if (activeProperty?.tenant_name) participants.push({ id: "active-tenant", name: activeProperty.tenant_name, role: "Locataire", subtitle: activeProperty.address, initials: activeProperty.tenant_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: "sage", tag: "Locataire" });
    const shared = CONTACTS.filter((contact) => !/propriétaire bailleur|syndic/i.test(contact.role));
    return [...participants.filter((contact) => contact.name !== user?.name), ...shared, ...customContacts];
  }, [activeProperty, customContacts, user?.name]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return contacts.filter((contact) => {
      const matchesFilter = filter === "Tous" || groupOf(contact) === filter;
      const matchesQuery =
        !q ||
        normalize(
          `${contact.name} ${contact.role} ${contact.subtitle} ${contact.email ?? ""} ${contact.phone ?? ""}`,
        ).includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [contacts, filter, query]);

  const stats = [
    {
      label: "Interlocuteurs",
      value: String(contacts.length).padStart(2, "0"),
      helper: "Cercle du logement",
      icon: Users,
      tone: "bg-cream-soft text-petrol",
    },
    {
      label: "Contacts ajoutés",
      value: String(customContacts.length).padStart(2, "0"),
      helper: "Enregistrés pour ce logement",
      icon: BadgeCheck,
      tone: "bg-sage-soft text-sage",
    },
    {
      label: "Propriétaire",
      value: activeProperty?.owner_name ? "1" : "0",
      helper: activeProperty?.owner_name || "Non renseigné",
      icon: ShieldCheck,
      tone: "bg-sky-soft text-sky-dark",
    },
    {
      label: "Logement actif",
      value: activeProperty ? "1" : "0",
      helper: activeProperty?.address || "À sélectionner",
      icon: LifeBuoy,
      tone: "bg-peach-soft text-peach-dark",
    },
  ];

  const submitContact = () => {
    if (!draft.name.trim()) {
      showToast("Nom requis", "Renseignez au moins le nom de votre interlocuteur.", "warning");
      return;
    }
    if (!draft.email.trim() && !draft.phone.trim()) {
      showToast(
        "Coordonnées manquantes",
        "Ajoutez un email ou un téléphone pour pouvoir contacter ce contact.",
        "warning",
      );
      return;
    }
    const isArtisan = /artisan|menuisier|plomb|électric/i.test(draft.role);
    const contact: Contact = {
      id: `custom-${Date.now()}`,
      name: draft.name.trim(),
      role: draft.role,
      subtitle: draft.subtitle.trim() || "Contact ajouté à votre carnet LIAISON.",
      initials: initials(draft.name),
      color: isArtisan ? "sage" : "sky",
      phone: draft.phone.trim() || undefined,
      email: draft.email.trim() || undefined,
      lastContact: "À l'instant",
      tag: "Ajouté",
      certified: false,
    };
    const next = [...customContacts, contact];
    setCustomContacts(next);
    try {
      if (contactsKey) window.localStorage.setItem(contactsKey, JSON.stringify(next));
    } catch {
      // The contact stays available for this session even if storage is full.
    }
    setAddOpen(false);
    setDraft({ name: "", role: ROLE_OPTIONS[1], email: "", phone: "", subtitle: "" });
    showToast("Contact ajouté", `${contact.name} rejoint votre cercle d'interlocuteurs.`);
  };

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Carnet du logement
              <span className="text-muted/50">·</span>
              <span className="font-medium normal-case tracking-normal text-muted">
                Contacts du logement actif
              </span>
            </p>
            <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
              Contacts &amp; artisans
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Bailleur, artisans et syndic : retrouvez les bons interlocuteurs et écrivez-leur depuis
              un canal horodaté.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openNewTicket("autre")}
              className="btn-soft h-10"
            >
              <LifeBuoy className="h-4 w-4 text-sage" />
              Contacter le support
            </button>
            <button type="button" onClick={() => setAddOpen(true)} className="btn-dark h-10">
              <Plus className="h-4 w-4" />
              Ajouter un contact
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

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="card flex h-10 flex-1 items-center gap-2 px-3.5 shadow-none">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un nom, un artisan, un email…"
              className="min-w-0 flex-1 bg-transparent text-[10.5px] text-ink outline-none placeholder:text-muted/70"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[9px] font-semibold text-muted hover:text-ink"
              >
                Effacer
              </button>
            )}
          </div>
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {FILTERS.map((item) => {
              const count =
                item === "Tous"
                  ? contacts.length
                  : contacts.filter((contact) => groupOf(contact) === item).length;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  aria-pressed={filter === item}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[9.5px] font-semibold transition",
                    filter === item
                      ? "bg-petrol text-white"
                      : "border border-line bg-white/70 text-muted hover:text-ink",
                  )}
                >
                  {item}
                  <span className={cn("text-[8px]", filter === item ? "text-white/55" : "text-muted/60")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="card mt-3 flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-soft text-muted">
              <Users className="h-5 w-5" />
            </span>
            <h2 className="mt-3 font-headline text-[16px] font-bold text-ink">
              Aucun contact trouvé
            </h2>
            <p className="mt-1 max-w-xs text-[10.5px] leading-relaxed text-muted">
              Modifiez votre recherche ou ajoutez un nouvel interlocuteur à votre carnet.
            </p>
            <button type="button" onClick={() => setAddOpen(true)} className="btn-dark mt-3 h-9 px-4 text-[10px]">
              <Plus className="h-3.5 w-3.5" />
              Ajouter un contact
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((contact) => (
              <div
                key={contact.id}
                id={`contact-${contact.id}`}
                className="scroll-mt-28 animate-fade-in"
              >
                <ContactCard contact={contact} highlight={highlight === contact.id} />
              </div>
            ))}
          </div>
        )}

        <section className="card mt-3.5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="eyebrow">Urgences &amp; services</p>
              <h2 className="mt-1 font-headline text-[16px] font-bold tracking-[-0.02em] text-ink">
                Qui appeler en cas de problème ?
              </h2>
            </div>
            <span className="chip bg-peach text-peach-dark">Numéros utiles</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {EMERGENCY.map((item) => (
              <a
                key={item.label}
                href={`tel:${item.phone.replace(/\s/g, "")}`}
                className="group rounded-xl border border-line/80 bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-[8px]",
                      item.tone,
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[8px] font-bold uppercase tracking-wide text-muted">
                    {item.label}
                  </p>
                  <ArrowUpRight className="ml-auto h-3 w-3 text-muted/60 transition group-hover:text-sage" />
                </div>
                <p className="mt-2 text-[10px] font-bold text-ink">{item.name}</p>
                <p className="mt-0.5 text-[8px] text-muted">{item.detail}</p>
                <p className="mt-1.5 flex items-center gap-1 text-[9.5px] font-bold text-sage">
                  <Phone className="h-2.5 w-2.5" />
                  {item.phone}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-3.5 flex flex-col gap-3 rounded-card border border-line/70 bg-white/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-headline text-[13px] font-bold text-ink">
                Un interlocuteur manque à votre ticket ?
              </h2>
              <p className="mt-0.5 max-w-lg text-[9.5px] leading-relaxed text-muted">
                L&apos;équipe LIAISON peut vérifier une coordonnée, ajouter un artisan ou vous aider à
                reprendre contact avec le bailleur.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href="/conversations" className="btn-soft h-9 text-[10px]">
              <Mail className="h-3.5 w-3.5" />
              Ouvrir les conversations
            </Link>
            <button
              type="button"
              onClick={() => openNewTicket("autre")}
              className="btn-dark h-9 text-[10px]"
            >
              <Plus className="h-3.5 w-3.5" />
              Ouvrir une demande
            </button>
          </div>
        </section>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        className="max-w-[560px]"
        ariaLabel="Ajouter un contact"
      >
        <div className="p-5 pr-14">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-petrol text-white">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-headline text-[16px] font-bold tracking-[-0.02em] text-ink">
                Ajouter un contact
              </h2>
              <p className="text-[9px] text-muted">Carnet privé de votre logement</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label htmlFor="contact-name" className="text-[9px] font-bold text-ink">
                Nom ou raison sociale <span className="text-danger">*</span>
              </label>
              <input
                id="contact-name"
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Ex. Électricité Dupont"
                className="field mt-1 h-9 text-[10px]"
              />
            </div>
            <div>
              <label htmlFor="contact-role" className="text-[9px] font-bold text-ink">
                Rôle
              </label>
              <select
                id="contact-role"
                value={draft.role}
                onChange={(event) => setDraft((prev) => ({ ...prev, role: event.target.value }))}
                className="field mt-1 h-9 text-[10px]"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="contact-phone" className="text-[9px] font-bold text-ink">
                Téléphone
              </label>
              <input
                id="contact-phone"
                value={draft.phone}
                onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+33 1 23 45 67 89"
                className="field mt-1 h-9 text-[10px]"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="contact-email" className="text-[9px] font-bold text-ink">
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="contact@exemple.fr"
                className="field mt-1 h-9 text-[10px]"
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="contact-subtitle" className="text-[9px] font-bold text-ink">
                Précision (optionnel)
              </label>
              <input
                id="contact-subtitle"
                value={draft.subtitle}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, subtitle: event.target.value }))
                }
                placeholder="Ex. Intervention chauffe-eau"
                className="field mt-1 h-9 text-[10px]"
              />
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-line/70 bg-cream-soft px-3 py-2">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-sage" />
            <p className="text-[8px] leading-relaxed text-muted">
              Ce contact reste privé et n&apos;est pas partagé avec le bailleur. Vous pouvez le
              contacter depuis votre carnet ou l&apos;associer à un ticket.
            </p>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="btn-soft h-9 px-3.5 text-[10.5px]"
            >
              Annuler
            </button>
            <button type="button" onClick={submitContact} className="btn-dark h-9 px-4 text-[10.5px]">
              <Plus className="h-3.5 w-3.5" />
              Ajouter au carnet
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
