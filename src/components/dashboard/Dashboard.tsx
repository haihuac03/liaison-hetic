"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MessageSquare,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { getTicketStats } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import TicketCard from "@/components/dashboard/TicketCard";
import PropertyCard from "@/components/dashboard/PropertyCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import ContactsCard from "@/components/dashboard/ContactsCard";
import { ticketAttention, useProperty } from "@/lib/property";

export default function Dashboard() {
  const { user } = useAuth();
  const { activeProperty: property, scopedTickets: tickets, setActiveProperty } = useProperty();
  const { openNewTicket } = useUI();
  const stats = getTicketStats(tickets);
  const activeTickets = tickets.filter(t => !["resolu", "ferme"].includes(t.status)).slice(0, 3);
  const featuredTicket = tickets.find((ticket) => !["resolu", "ferme"].includes(ticket.status));
  const isTenant = user?.role === "tenant";
  const firstName = user?.name?.split(/\s+/)[0] || "vous";
  const attention = featuredTicket ? ticketAttention(featuredTicket, user?.id, user?.role) : null;

  return (
    <div className="animate-fade-up">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-headline text-[29px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[33px]">
            Bonjour {firstName} <span className="inline-block origin-bottom-right animate-pulse-soft">👋</span>
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
            Voici ce qui se passe dans votre logement aujourd&apos;hui :{" "}
            <span className="font-semibold text-ink/80">{property?.address || "ajoutez votre logement pour commencer"}</span>.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <span className="chip bg-sage-light text-sage-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              {property?.tenant_id ? "Logement partagé" : property ? "Logement actif" : "Aucun logement actif"}
            </span>
            <span className="chip bg-sage-light text-sage-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              {property?.tenant_id ? "Locataire rattaché" : isTenant ? "En attente de confirmation" : "Invitation à transmettre"}
            </span>
            {featuredTicket && (
              <Link href={`/tickets/${featuredTicket.id}`} onClick={() => featuredTicket.propertyId && setActiveProperty(featuredTicket.propertyId)} className="chip bg-sky text-sky-dark transition hover:bg-[#D7E7F0]">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-dark" />{featuredTicket.badge} · {featuredTicket.title}
              </Link>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href={isTenant ? "/loyer" : "/contrat"} className="btn-soft h-10 bg-transparent shadow-none">
            <MessageSquare className="h-4 w-4" />
            <span>{isTenant ? "Voir mon loyer" : "Baux & documents"}</span>
          </Link>
          {user && (
            <button type="button" onClick={() => openNewTicket()} disabled={!property || (!isTenant && !property.tenant_id)} className="btn-dark h-10 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              <span>{isTenant ? "Signaler un problème" : "Créer un dossier"}</span>
            </button>
          )}
        </div>
      </header>

      {featuredTicket && <section className={cn("relative mt-5 overflow-hidden rounded-card p-5 shadow-[0_22px_45px_-30px_rgba(36,59,71,0.65)] sm:p-6", isTenant ? "bg-sage-dark" : "bg-petrol")}>
        <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-white/[0.035]" />
        <div className="pointer-events-none absolute -bottom-32 right-32 h-64 w-64 rounded-full border border-white/[0.045]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white/10 text-white ring-1 ring-white/10">
              <Wrench className="h-[19px] w-[19px]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                  {featuredTicket.badge}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", attention?.owner === "you" ? "bg-peach text-peach-dark" : "bg-white/10 text-white/65")}>
                  {attention?.label || featuredTicket.badge}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/65">
                  #{featuredTicket.id.slice(0, 8)}
                </span>
              </div>
              <h2 className="mt-1.5 max-w-2xl font-headline text-[18px] font-semibold leading-snug tracking-[-0.015em] text-white sm:text-[20px]">
                {featuredTicket.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10.5px] text-white/75">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-white/60" />
                  Dernière activité : {featuredTicket.updatedAt}
                </span>
                <span className="flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5 text-white/60" />
                  {featuredTicket.assignee}
                  <span className="text-white/40">(Autre partie du logement)</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[60px] lg:pl-0">
            <Link href={`/tickets/${featuredTicket.id}`} onClick={() => featuredTicket.propertyId && setActiveProperty(featuredTicket.propertyId)} className="btn-sage h-9 px-3.5 text-[11.5px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              Suivi en direct
            </Link>
            <Link
              href={`/tickets/${featuredTicket.id}#chat`}
              onClick={() => featuredTicket.propertyId && setActiveProperty(featuredTicket.propertyId)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-3.5 text-[11.5px] font-semibold text-white transition hover:bg-white/[0.12]"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Échanger
            </Link>
          </div>
        </div>
      </section>}

      <div className="mt-4 grid gap-3.5 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-1 xl:col-span-4">
          <PropertyCard />
        </div>

        <div className="md:col-span-1 xl:col-span-5">
          <section className="card flex h-full flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Suivi des demandes</p>
                <h2 className="mt-1 font-headline text-[18px] font-bold leading-tight tracking-[-0.025em] text-ink">
                  Dossiers actifs
                </h2>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <span className="chip bg-sky text-sky-dark">{stats.active} en cours</span>
                <span className="chip bg-peach text-peach-dark">{tickets.filter(t => t.status === "en_litige").length} en litige</span>
                <span className="chip bg-sage-light text-sage-dark">{stats.resolved + stats.closed} clos</span>
              </div>
            </div>

            <div className="mt-3.5 flex flex-1 flex-col gap-2">
              {activeTickets.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-cream-soft px-4 py-8 text-center">
                  <p className="text-[12px] font-bold text-ink">Aucun ticket pour le moment</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">
                    {isTenant ? "Créez un ticket pour signaler un problème." : "Créez un ticket pour échanger avec votre locataire."}
                  </p>
                </div>
              )}
              {activeTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>

            <Link
              href="/tickets"
              className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-cream-soft text-[11px] font-bold text-ink transition hover:bg-cream-dark"
            >
              Voir les dossiers du logement ({tickets.length})
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>

      </div>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-1 xl:col-span-7">
          <ActivityFeed />
        </div>
        <div className="md:col-span-1 xl:col-span-5">
          <ContactsCard />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-white/45 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sage" />
          <p className="text-[10px] font-medium text-muted">
            Dossiers LIAISON · {tickets.length} tickets · échanges enregistrés
          </p>
        </div>
        <div className="flex items-center gap-3 text-[9.5px] font-semibold text-muted">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-sage" /> Espace partagé
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-sage" /> Données enregistrées
          </span>
        </div>
      </div>
    </div>
  );
}
