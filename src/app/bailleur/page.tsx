"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, Plus, Ticket, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import RoleBadge from "@/components/layout/RoleBadge";
import TicketCard from "@/components/dashboard/TicketCard";
import { useAuth } from "@/lib/auth";
import { useProperty } from "@/lib/property";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";

export default function OwnerPage() {
  const { user, properties, loading } = useAuth();
  const { activePropertyId, scopedTickets, setActiveProperty } = useProperty();
  const { openNewTicket } = useUI();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== "owner") router.replace("/");
  }, [loading, user, router]);

  if (loading || user?.role !== "owner") {
    return <AppShell><p className="p-8 text-muted">Chargement du portefeuille…</p></AppShell>;
  }

  const activeTickets = scopedTickets.filter((ticket) => !["ferme", "resolu"].includes(ticket.status));
  const linked = properties.filter((property) => property.tenant_id);
  const activeProperty = properties.find((property) => property.id === activePropertyId);

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><RoleBadge role="owner" /><span className="text-[10px] font-semibold text-muted">Portefeuille</span></div>
            <h1 className="mt-2 font-headline text-[30px] font-extrabold tracking-tight text-ink">Mes logements</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">Choisissez un logement pour limiter les dossiers, baux et loyers affichés à ce contexte.</p>
          </div>
          <button onClick={() => openNewTicket()} disabled={!activeProperty?.tenant_id} className="btn-dark h-10 disabled:opacity-50"><Plus className="h-4 w-4" />Créer un dossier</button>
        </header>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Logements", value: properties.length, detail: `${linked.length} avec locataire` },
            { label: "Dossiers du logement actif", value: activeTickets.length, detail: activeProperty?.address || "Aucun contexte" },
            { label: "Clôtures à décider", value: scopedTickets.filter((ticket) => ticket.status === "en_cloture").length, detail: "Pour le logement actif" },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">{stat.label}</p>
              <p className="mt-1 font-headline text-2xl font-extrabold text-ink">{stat.value}</p>
              <p className="mt-1 truncate text-[9px] text-muted">{stat.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="card p-4 sm:p-5">
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-petrol" /><h2 className="font-headline text-lg font-bold">Choisir le logement actif</h2></div>
            <div className="mt-4 flex flex-col gap-2">
              {properties.map((property) => {
                const selected = property.id === activePropertyId;
                const count = selected ? scopedTickets.length : undefined;
                return (
                  <button key={property.id} type="button" onClick={() => setActiveProperty(property.id)} className={cn("rounded-xl border p-3 text-left transition", selected ? "border-petrol bg-petrol text-white" : "border-line bg-cream-soft/70 hover:border-petrol/30 hover:bg-white")}>
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-bold">{property.address}</p>{selected && <CheckCircle2 className="h-4 w-4 shrink-0" />}</div>
                    <p className={cn("mt-1 flex items-center gap-1 text-[9px]", selected ? "text-white/65" : "text-muted")}><UserRound className="h-3 w-3" />{property.tenant_name || "Aucun locataire rattaché"}</p>
                    {count !== undefined && <p className="mt-1 text-[9px] text-white/55">{count} dossier{count > 1 ? "s" : ""}</p>}
                  </button>
                );
              })}
              {!properties.length && <p className="rounded-xl bg-cream-soft p-4 text-sm text-muted">Ajoutez votre premier logement.</p>}
            </div>
            <Link href="/logements" className="btn-soft mt-4 h-9 text-xs">Gérer les logements et invitations</Link>
          </section>

          <section className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2"><div><h2 className="font-headline text-lg font-bold">Dossiers à suivre</h2><p className="mt-1 text-xs text-muted">{activeProperty?.address || "Sélectionnez un logement"}</p></div><Ticket className="h-4 w-4 text-sage" /></div>
            <div className="mt-4 flex flex-col gap-2">
              {activeTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
              {!activeTickets.length && <p className="rounded-xl bg-cream-soft p-5 text-sm text-muted">Aucun dossier actif pour ce logement.</p>}
            </div>
            <Link href="/tickets" className="mt-4 flex items-center gap-1.5 text-xs font-bold text-sage">Voir les dossiers du logement actif <ArrowRight className="h-3 w-3" /></Link>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
