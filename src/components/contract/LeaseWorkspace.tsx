"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Euro,
  FileSignature,
  Pencil,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import ContractDocuments from "./ContractDocuments";
import {
  documentLeaseId,
  documentPropertyId,
  formatCents,
  formatLongDate,
  leaseChargesCents,
  leaseDepositCents,
  leaseEndsOn,
  leasePaymentDay,
  leasePropertyId,
  leaseRentCents,
  leaseStartsOn,
  type LeaseCoreState,
  type LeaseRecord,
} from "./lease-types";
import { coreRequest, useCoreAuth } from "@/lib/client/core";
import { useAuth } from "@/lib/auth";
import { useProperty as useActiveProperty } from "@/lib/property";

interface LeaseFormState {
  startsOn: string;
  endsOn: string;
  rent: string;
  charges: string;
  deposit: string;
  paymentDay: string;
}

const emptyForm: LeaseFormState = {
  startsOn: "",
  endsOn: "",
  rent: "",
  charges: "",
  deposit: "",
  paymentDay: "1",
};

function formFromLease(lease: LeaseRecord): LeaseFormState {
  return {
    startsOn: leaseStartsOn(lease),
    endsOn: leaseEndsOn(lease),
    rent: (leaseRentCents(lease) / 100).toFixed(2),
    charges: (leaseChargesCents(lease) / 100).toFixed(2),
    deposit: (leaseDepositCents(lease) / 100).toFixed(2),
    paymentDay: String(leasePaymentDay(lease)),
  };
}

function toCents(value: string) {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

function messageFrom(cause: unknown) {
  return cause instanceof Error ? cause.message : "L'opération a échoué. Réessayez.";
}

export default function LeaseWorkspace() {
  const auth = useAuth();
  const coreSession = useCoreAuth();
  const core = coreSession.core as LeaseCoreState | null;
  const { activeProperty, activePropertyId } = useActiveProperty();
  const propertyId = activePropertyId ?? activeProperty?.id ?? "";
  const coreProperty = core?.properties?.find((property) => property.id === propertyId);
  const property = coreProperty ?? activeProperty;
  const isOwner = auth.user?.role === "owner";

  const leases = useMemo(() => {
    if (!Array.isArray(core?.leases)) return [];
    return [...core.leases]
      .filter((lease) => leasePropertyId(lease) === propertyId && lease.status === "active")
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
  }, [core?.leases, propertyId]);
  const lease = leases[0];

  const documents = useMemo(() => {
    if (!Array.isArray(core?.property_documents)) return [];
    return core.property_documents
      .filter((document) => documentPropertyId(document) === propertyId)
      .filter((document) => {
        const linkedLeaseId = documentLeaseId(document);
        return !linkedLeaseId || linkedLeaseId === lease?.id;
      })
      .sort(
        (a, b) =>
          (b.created_at ?? b.createdAt ?? 0) - (a.created_at ?? a.createdAt ?? 0),
      );
  }, [core?.property_documents, lease?.id, propertyId]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LeaseFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(lease ? formFromLease(lease) : emptyForm);
    setEditing(!lease && isOwner);
    setError("");
  }, [isOwner, lease?.id, lease?.version, propertyId]);

  const updateField = (name: keyof LeaseFormState, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner || !propertyId) return;
    setError("");

    const rentCents = toCents(form.rent);
    const chargesCents = toCents(form.charges);
    const depositCents = toCents(form.deposit);
    const paymentDay = Number(form.paymentDay);
    if (!form.startsOn) return setError("La date de début du bail est obligatoire.");
    if (![rentCents, chargesCents, depositCents].every(Number.isFinite)) {
      return setError("Les montants doivent être renseignés correctement.");
    }
    if (rentCents < 0 || chargesCents < 0 || depositCents < 0) {
      return setError("Les montants ne peuvent pas être négatifs.");
    }
    if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31) {
      return setError("Le jour de paiement doit être compris entre 1 et 31.");
    }
    if (form.endsOn && form.endsOn < form.startsOn) {
      return setError("La date de fin doit être postérieure à la date de début.");
    }

    setBusy(true);
    try {
      await coreRequest("lease/save", {
        propertyId,
        startsOn: form.startsOn,
        ...(form.endsOn ? { endsOn: form.endsOn } : {}),
        rentCents,
        chargesCents,
        depositCents,
        paymentDay,
        ...(lease ? { expectedVersion: lease.version ?? 1 } : {}),
      });
      await coreSession.refresh();
      await auth.refresh();
      setEditing(false);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(false);
    }
  };

  const loading = auth.loading || coreSession.loading;
  const pageTitle = isOwner ? "Bail & documents" : "Mon bail";

  if (loading) {
    return (
      <div className="card p-8 text-center text-sm text-muted">Chargement du bail…</div>
    );
  }

  if (!propertyId || !property) {
    return (
      <section className="card mx-auto max-w-2xl p-8 text-center">
        <Building2 className="mx-auto h-7 w-7 text-sage" />
        <h1 className="mt-3 font-headline text-2xl font-bold text-ink">{pageTitle}</h1>
        <p className="mt-2 text-sm text-muted">
          Aucun logement actif n’est sélectionné. Choisissez un logement pour afficher son bail.
        </p>
        <Link href="/logements" className="btn-dark mt-5 h-10">
          Choisir un logement
        </Link>
      </section>
    );
  }

  return (
    <div className="animate-fade-up">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sage" />
            {property.address}
          </p>
          <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
            {pageTitle}
          </h1>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
            Les conditions du bail et les documents partagés pour ce logement.
          </p>
        </div>
        {isOwner && lease && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="btn-dark h-10">
            <Pencil className="h-4 w-4" />
            Modifier le bail
          </button>
        )}
      </header>

      {(error || coreSession.error) && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || coreSession.error}
        </p>
      )}

      {!lease && !isOwner && (
        <section className="card mt-5 p-8 text-center">
          <FileSignature className="mx-auto h-7 w-7 text-muted" />
          <h2 className="mt-3 text-lg font-bold text-ink">Aucun bail partagé</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            Votre propriétaire doit enregistrer le bail de ce logement. Vous pourrez ensuite le
            consulter et y déposer vos justificatifs.
          </p>
        </section>
      )}

      {(editing || !lease) && isOwner && (
        <section className="card mt-5 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-sage" />
            <h2 className="font-headline text-lg font-bold text-ink">
              {lease ? "Modifier les conditions du bail" : "Enregistrer le bail"}
            </h2>
          </div>
          <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink">
              Date de début
              <input
                type="date"
                required
                value={form.startsOn}
                onChange={(event) => updateField("startsOn", event.target.value)}
                className="field mt-2"
              />
            </label>
            <label className="text-xs font-semibold text-ink">
              Date de fin <span className="font-normal text-muted">(facultatif)</span>
              <input
                type="date"
                value={form.endsOn}
                min={form.startsOn || undefined}
                onChange={(event) => updateField("endsOn", event.target.value)}
                className="field mt-2"
              />
            </label>
            <label className="text-xs font-semibold text-ink">
              Loyer mensuel, hors charges
              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.rent}
                  onChange={(event) => updateField("rent", event.target.value)}
                  className="field pr-8"
                  placeholder="0,00"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">€</span>
              </div>
            </label>
            <label className="text-xs font-semibold text-ink">
              Charges mensuelles
              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.charges}
                  onChange={(event) => updateField("charges", event.target.value)}
                  className="field pr-8"
                  placeholder="0,00"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">€</span>
              </div>
            </label>
            <label className="text-xs font-semibold text-ink">
              Dépôt de garantie
              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.deposit}
                  onChange={(event) => updateField("deposit", event.target.value)}
                  className="field pr-8"
                  placeholder="0,00"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">€</span>
              </div>
            </label>
            <label className="text-xs font-semibold text-ink">
              Jour de paiement
              <input
                type="number"
                min="1"
                max="31"
                required
                value={form.paymentDay}
                onChange={(event) => updateField("paymentDay", event.target.value)}
                className="field mt-2"
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-dark h-10 disabled:opacity-50">
                {busy ? "Enregistrement…" : "Enregistrer le bail"}
              </button>
              {lease && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setForm(formFromLease(lease));
                    setEditing(false);
                    setError("");
                  }}
                  className="btn-soft h-10"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {lease && !editing && (
        <div className="mt-5 grid items-start gap-4 xl:grid-cols-[1.45fr_.8fr]">
          <section className="card overflow-hidden p-0">
            <div className="border-b border-line bg-petrol p-5 text-white sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/90">
                    <CheckCircle2 className="h-3 w-3" /> Bail enregistré
                  </span>
                  <h2 className="mt-3 font-headline text-2xl font-bold">Bail du logement</h2>
                  <p className="mt-1 text-xs text-white/60">{property.address}</p>
                </div>
                <FileSignature className="h-7 w-7 text-mint" />
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">Loyer hors charges</p>
                  <p className="mt-1 text-sm font-bold">{formatCents(leaseRentCents(lease))}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">Charges</p>
                  <p className="mt-1 text-sm font-bold">{formatCents(leaseChargesCents(lease))}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-[9px] uppercase tracking-[0.08em] text-white/45">Total mensuel</p>
                  <p className="mt-1 text-sm font-bold">
                    {formatCents(leaseRentCents(lease) + leaseChargesCents(lease))}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <InfoRow icon={CalendarDays} label="Début du bail" value={formatLongDate(leaseStartsOn(lease))} />
              <InfoRow icon={CalendarDays} label="Fin du bail" value={leaseEndsOn(lease) ? formatLongDate(leaseEndsOn(lease)) : "Sans terme renseigné"} />
              <InfoRow icon={Euro} label="Dépôt de garantie" value={formatCents(leaseDepositCents(lease))} />
              <InfoRow icon={ShieldCheck} label="Jour de paiement" value={`Le ${leasePaymentDay(lease)} de chaque mois`} />
            </div>
          </section>

          <section className="card p-5">
            <p className="eyebrow">Parties au bail</p>
            <h2 className="mt-1 font-headline text-lg font-bold text-ink">Interlocuteurs</h2>
            <div className="mt-4 space-y-2">
              <PartyRow label="Propriétaire" name={coreProperty?.owner_name ?? property.owner_name ?? "Propriétaire"} />
              <PartyRow label="Locataire" name={coreProperty?.tenant_name ?? property.tenant_name ?? "Locataire non rattaché"} />
            </div>
            <p className="mt-4 rounded-xl bg-cream-soft p-3 text-[11px] leading-relaxed text-muted">
              Les informations affichées proviennent du bail enregistré pour ce logement. Une
              modification crée une nouvelle version des conditions du bail.
            </p>
          </section>
        </div>
      )}

      {lease && (
        <div className="mt-4">
          <ContractDocuments
            propertyId={propertyId}
            leaseId={lease.id}
            documents={documents}
            canUpload
            onUploaded={async () => {
              await coreSession.refresh();
              await auth.refresh();
            }}
          />
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-cream-soft/50 p-3">
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function PartyRow({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-white p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-soft text-sage-dark">
        <UserRound className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="text-sm font-semibold text-ink">{name}</p>
      </div>
    </div>
  );
}
