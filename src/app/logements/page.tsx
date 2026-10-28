"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, Check, Copy, Plus } from "lucide-react";
import AppShell from "@/components/AppShell";
import RoleBadge from "@/components/layout/RoleBadge";
import { coreRequest, useAuth } from "@/lib/auth";
import { useProperty } from "@/lib/property";
import { cn } from "@/lib/utils";

export default function PropertiesPage() {
  const { user, properties, invitations, refresh } = useAuth();
  const { activePropertyId, setActiveProperty } = useProperty();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [now] = useState(() => Date.now());

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      await coreRequest("property", { address: new FormData(form).get("address") });
      await refresh();
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ajout impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(code: string, link = false) {
    try {
      await navigator.clipboard.writeText(link ? `${window.location.origin}/invitation?code=${code}` : code);
      setCopied(code + (link ? "link" : ""));
    } catch {
      setError("La copie est indisponible. Sélectionnez le code ou le lien pour le copier.");
    }
  }

  const isOwner = user?.role === "owner";

  return (
    <AppShell>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <RoleBadge role={isOwner ? "owner" : "tenant"} />
          <h1 className="mt-2 text-3xl font-bold text-petrol">Mes logements</h1>
          <p className="mt-2 text-sm text-muted">Choisissez le logement actif. Les dossiers, baux et loyers seront limités à ce contexte.</p>
        </div>
        <Link href={isOwner ? "/tickets" : "/invitation"} className="btn-soft h-10 text-xs">{isOwner ? "Voir les dossiers" : "Rejoindre un autre logement"}</Link>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {properties.map((property) => {
          const active = property.id === activePropertyId;
          const invite = invitations.find((item) => item.property_id === property.id && !item.used_at);
          const expired = Boolean(invite && invite.expires < now);
          return (
            <section key={property.id} className={cn("card p-6", active && (isOwner ? "border-petrol/30" : "border-sage/40"))}>
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-petrol text-white" : "bg-sage-soft text-sage")}><Building2 className="h-5 w-5" /></span>
                {active ? <span className="chip bg-sage-light text-sage-dark"><Check className="h-3 w-3" />Logement actif</span> : <button type="button" onClick={() => setActiveProperty(property.id)} className="btn-soft h-8 px-3 text-[9px]">Utiliser ce logement</button>}
              </div>
              <h2 className="mt-4 text-lg font-bold">{property.address}</h2>
              <p className="mt-2 text-sm text-muted">{property.tenant_id ? `${property.tenant_name || "Locataire"} · propriétaire ${property.owner_name}` : isOwner ? "Aucun locataire rattaché" : "Rattachement en attente"}</p>

              {isOwner && invite && !property.tenant_id && (
                <div className="mt-5 rounded-xl bg-cream p-4">
                  <p className="eyebrow">Code d’invitation {expired ? "expiré" : "· valable 7 jours"}</p>
                  <p className="my-3 font-mono text-3xl font-bold tracking-[0.3em]">{invite.code}</p>
                  {!expired && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void copy(invite.code)} className="btn-soft h-9 text-xs">{copied === invite.code ? <Check size={14} /> : <Copy size={14} />} Copier le code</button>
                        <button onClick={() => void copy(invite.code, true)} className="btn-dark h-9 text-xs">{copied === `${invite.code}link` ? "Lien copié" : "Copier le lien"}</button>
                      </div>
                      <a className="mt-3 block break-all text-xs text-petrol underline" href={`/invitation?code=${invite.code}`}>{typeof window !== "undefined" ? window.location.origin : ""}/invitation?code={invite.code}</a>
                    </>
                  )}
                  <button className="mt-4 text-xs font-semibold text-petrol underline" onClick={async () => { try { await coreRequest("renew", { propertyId: property.id }); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Renouvellement impossible."); } }}>Générer un nouveau code</button>
                </div>
              )}
              {active && <div className="mt-4 flex gap-2"><Link href="/contrat" className="btn-soft h-9 text-[10px]">{isOwner ? "Baux & documents" : "Mon bail"}</Link><Link href="/loyer" className="btn-soft h-9 text-[10px]">{isOwner ? "Loyers" : "Mon loyer"}</Link></div>}
            </section>
          );
        })}

        {isOwner && (
          <section className="card p-6">
            <span className="inline-flex rounded-xl bg-sage-soft p-3 text-sage"><Plus size={22} /></span>
            <h2 className="mt-4 text-lg font-bold">Ajouter un logement</h2>
            <p className="mb-5 mt-2 text-sm text-muted">L’adresse permettra au locataire de reconnaître son logement.</p>
            <form onSubmit={add} className="space-y-4">
              <label className="block text-xs font-semibold">Adresse complète<input name="address" required minLength={5} className="field mt-2" placeholder="12 rue des Lilas, 75011 Paris · Appartement 3B" /></label>
              <button disabled={busy} className="btn-dark h-11 disabled:opacity-50">{busy ? "Création…" : "Créer le logement et son invitation"}</button>
            </form>
          </section>
        )}

        {!properties.length && !isOwner && (
          <section className="card p-7"><h2 className="font-bold">Aucun logement rattaché</h2><p className="my-3 text-sm text-muted">Utilisez l’invitation transmise par votre propriétaire.</p><Link href="/invitation" className="btn-dark h-11">Saisir mon code</Link></section>
        )}
      </div>
    </AppShell>
  );
}
