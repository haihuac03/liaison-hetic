"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  Download,
  FileText,
  Landmark,
  ReceiptText,
  Wallet,
} from "lucide-react";
import {
  documentLeaseId,
  documentName,
  documentPropertyId,
  formatCents,
  formatLongDate,
  formatPeriod,
  leaseChargesCents,
  leasePropertyId,
  leaseRentCents,
  rentPeriodDueOn,
  rentPeriodLeaseId,
  rentPeriodMonth,
  rentPeriodPaidOn,
  statusLabel,
  type LeaseCoreState,
  type RentPeriodRecord,
} from "@/components/contract/lease-types";
import { useAuth } from "@/lib/auth";
import { coreRequest, useCoreAuth } from "@/lib/client/core";
import { useProperty as useActiveProperty } from "@/lib/property";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultDueOn(period: string, paymentDay: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return `${period}-${String(Math.min(paymentDay, lastDay)).padStart(2, "0")}`;
}

function isPaid(period: RentPeriodRecord) {
  return ["paid", "paye", "payé"].includes((period.status ?? "").toLowerCase());
}

function periodAmount(period: RentPeriodRecord, rentCents: number, chargesCents: number) {
  const total = period.total_cents ?? period.totalCents;
  if (typeof total === "number") return total;
  const rent = period.rent_cents ?? period.rentCents ?? rentCents;
  const charges = period.charges_cents ?? period.chargesCents ?? chargesCents;
  return rent + charges;
}

function messageFrom(cause: unknown) {
  return cause instanceof Error ? cause.message : "L'opération a échoué. Réessayez.";
}

export default function RentWorkspace() {
  const auth = useAuth();
  const coreSession = useCoreAuth();
  const core = coreSession.core as LeaseCoreState | null;
  const { activeProperty, activePropertyId } = useActiveProperty();
  const propertyId = activePropertyId ?? activeProperty?.id ?? "";
  const coreProperty = core?.properties?.find((property) => property.id === propertyId);
  const property = coreProperty ?? activeProperty;
  const isOwner = auth.user?.role === "owner";

  const lease = useMemo(() => {
    if (!Array.isArray(core?.leases)) return undefined;
    return [...core.leases]
      .filter((item) => leasePropertyId(item) === propertyId && item.status === "active")
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))[0];
  }, [core?.leases, propertyId]);

  const periods = useMemo(() => {
    if (!lease || !Array.isArray(core?.rent_periods)) return [];
    return core.rent_periods
      .filter((period) => rentPeriodLeaseId(period) === lease.id)
      .sort((a, b) => rentPeriodMonth(b).localeCompare(rentPeriodMonth(a)));
  }, [core?.rent_periods, lease]);

  const receipts = useMemo(() => {
    if (!Array.isArray(core?.property_documents)) return [];
    return core.property_documents
      .filter((document) => documentPropertyId(document) === propertyId)
      .filter((document) => !documentLeaseId(document) || documentLeaseId(document) === lease?.id)
      .filter((document) => {
        const haystack = `${document.kind ?? ""} ${document.category ?? ""} ${documentName(document)}`.toLowerCase();
        return Boolean(document.period_id ?? document.periodId) || haystack.includes("quittance") || haystack.includes("receipt");
      })
      .sort(
        (a, b) =>
          (b.created_at ?? b.createdAt ?? 0) - (a.created_at ?? a.createdAt ?? 0),
      );
  }, [core?.property_documents, lease?.id, propertyId]);

  const [period, setPeriod] = useState(currentMonth);
  const [dueOn, setDueOn] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = async () => {
    await coreSession.refresh();
    await auth.refresh();
  };

  const createPeriod = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner || !lease) return;
    setError("");
    setSuccess("");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      setError("Sélectionnez un mois valide.");
      return;
    }

    setBusy("create");
    try {
      await coreRequest("rent/period", {
        leaseId: lease.id,
        period,
        ...(dueOn ? { dueOn } : {}),
      });
      await refresh();
      setSuccess(`L'échéance de ${formatPeriod(period)} a été créée.`);
      setDueOn("");
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(null);
    }
  };

  const pay = async (rentPeriod: RentPeriodRecord) => {
    if (!isOwner) return;
    setError("");
    setSuccess("");
    setBusy(rentPeriod.id);
    try {
      await coreRequest("rent/pay", { periodId: rentPeriod.id });
      await refresh();
      setSuccess(`Le paiement de ${formatPeriod(rentPeriodMonth(rentPeriod))} a été enregistré.`);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setBusy(null);
    }
  };

  const loading = auth.loading || coreSession.loading;
  const pageTitle = isOwner ? "Loyers & quittances" : "Mon loyer";
  const totalDue = periods
    .filter((item) => !isPaid(item))
    .reduce((sum, item) => sum + periodAmount(item, leaseRentCents(lease!), leaseChargesCents(lease!)), 0);

  if (loading) {
    return <div className="card p-8 text-center text-sm text-muted">Chargement des loyers…</div>;
  }

  if (!propertyId || !property) {
    return (
      <section className="card mx-auto max-w-2xl p-8 text-center">
        <Building2 className="mx-auto h-7 w-7 text-sage" />
        <h1 className="mt-3 font-headline text-2xl font-bold text-ink">{pageTitle}</h1>
        <p className="mt-2 text-sm text-muted">
          Aucun logement actif n’est sélectionné. Choisissez un logement pour afficher ses loyers.
        </p>
        <Link href="/logements" className="btn-dark mt-5 h-10">Choisir un logement</Link>
      </section>
    );
  }

  return (
    <div className="animate-fade-up">
      <header>
        <p className="eyebrow flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-sage" />
          {property.address}
        </p>
        <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
          {pageTitle}
        </h1>
        <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
          Échéances, paiements et quittances du bail actif.
        </p>
      </header>

      {(error || coreSession.error) && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || coreSession.error}
        </p>
      )}
      {success && (
        <p role="status" className="mt-4 rounded-xl bg-sage-soft px-4 py-3 text-sm text-sage-dark">
          {success}
        </p>
      )}

      {!lease && (
        <section className="card mt-5 p-8 text-center">
          <Wallet className="mx-auto h-7 w-7 text-muted" />
          <h2 className="mt-3 text-lg font-bold text-ink">Aucun bail actif</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
            {isOwner
              ? "Enregistrez le bail de ce logement avant de créer une échéance de loyer."
              : "Votre propriétaire doit enregistrer le bail de ce logement avant l’affichage du loyer."}
          </p>
          {isOwner && (
            <Link href="/contrat" className="btn-dark mt-5 h-10">
              Enregistrer le bail
            </Link>
          )}
        </section>
      )}

      {lease && (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              icon={Wallet}
              label="Loyer hors charges"
              value={formatCents(leaseRentCents(lease))}
            />
            <SummaryCard
              icon={Landmark}
              label="Charges mensuelles"
              value={formatCents(leaseChargesCents(lease))}
            />
            <SummaryCard
              icon={ReceiptText}
              label="Solde à régler"
              value={formatCents(totalDue)}
              emphasis={totalDue > 0}
            />
          </section>

          {isOwner && (
            <section className="card mt-4 p-5">
              <div className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5 text-sage" />
                <h2 className="font-headline text-lg font-bold text-ink">Créer une échéance</h2>
              </div>
              <form onSubmit={createPeriod} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="text-xs font-semibold text-ink">
                  Mois
                  <input
                    type="month"
                    required
                    value={period}
                    onChange={(event) => {
                      setPeriod(event.target.value);
                      setDueOn(defaultDueOn(event.target.value, lease.payment_day ?? lease.paymentDay ?? 1));
                    }}
                    className="field mt-2"
                  />
                </label>
                <label className="text-xs font-semibold text-ink">
                  Date d’échéance <span className="font-normal text-muted">(facultatif)</span>
                  <input
                    type="date"
                    value={dueOn}
                    onChange={(event) => setDueOn(event.target.value)}
                    className="field mt-2"
                  />
                </label>
                <button type="submit" disabled={busy !== null} className="btn-dark h-10 disabled:opacity-50">
                  {busy === "create" ? "Création…" : "Créer l’échéance"}
                </button>
              </form>
            </section>
          )}

          <section className="card mt-4 overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <p className="eyebrow">Échéancier</p>
              <h2 className="mt-1 font-headline text-lg font-bold text-ink">Périodes de loyer</h2>
            </div>
            {periods.length ? (
              <div className="divide-y divide-line/70">
                {periods.map((rentPeriod) => {
                  const paid = isPaid(rentPeriod);
                  const amount = periodAmount(rentPeriod, leaseRentCents(lease), leaseChargesCents(lease));
                  return (
                    <article
                      key={rentPeriod.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold capitalize text-ink">
                          {formatPeriod(rentPeriodMonth(rentPeriod))}
                        </p>
                        <p className="mt-1 text-[11px] text-muted">
                          Échéance : {formatLongDate(rentPeriodDueOn(rentPeriod))}
                          {rentPeriodPaidOn(rentPeriod)
                            ? ` · Payé le ${formatLongDate(rentPeriodPaidOn(rentPeriod))}`
                            : ""}
                        </p>
                      </div>
                      <div className="sm:w-32">
                        <p className="text-sm font-bold text-ink">{formatCents(amount)}</p>
                        <p className="mt-0.5 text-[10px] text-muted">Loyer et charges</p>
                      </div>
                      <span
                        className={`chip self-start sm:self-auto ${
                          paid ? "bg-sage-light text-sage-dark" : "bg-peach-soft text-peach-dark"
                        }`}
                      >
                        {paid && <CheckCircle2 className="h-2.5 w-2.5" />}
                        {statusLabel(rentPeriod.status)}
                      </span>
                      {isOwner && !paid && (
                        <button
                          type="button"
                          onClick={() => void pay(rentPeriod)}
                          disabled={busy !== null}
                          className="btn-soft h-9 shrink-0 text-[11px] disabled:opacity-50"
                        >
                          {busy === rentPeriod.id ? "Enregistrement…" : "Enregistrer le paiement"}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-9 text-center">
                <ReceiptText className="mx-auto h-6 w-6 text-muted" />
                <p className="mt-2 text-sm font-semibold text-ink">Aucune échéance</p>
                <p className="mt-1 text-xs text-muted">
                  {isOwner
                    ? "Créez la première période de loyer ci-dessus."
                    : "Votre propriétaire n’a pas encore créé d’échéance."}
                </p>
              </div>
            )}
          </section>

          <section className="card mt-4 p-5">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-sage" />
              <div>
                <p className="eyebrow">Justificatifs</p>
                <h2 className="font-headline text-lg font-bold text-ink">Quittances</h2>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {receipts.map((document) => (
                <article
                  key={document.id}
                  className="flex flex-col gap-3 rounded-xl border border-line/70 p-3 sm:flex-row sm:items-center"
                >
                  <FileText className="h-4 w-4 shrink-0 text-petrol" />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {documentName(document)}
                  </p>
                  <a
                    href={`/api/core/lease-file/${encodeURIComponent(document.id)}`}
                    download={documentName(document)}
                    className="btn-soft h-9 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Télécharger
                  </a>
                </article>
              ))}
              {!receipts.length && (
                <p className="rounded-xl border border-dashed border-line bg-cream-soft/50 px-4 py-6 text-center text-xs text-muted">
                  Aucune quittance disponible. Elles apparaîtront après leur génération ou leur
                  dépôt dans les documents du logement.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  emphasis = false,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`card flex items-center gap-3 p-4 ${emphasis ? "border-peach" : ""}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-soft text-sage-dark">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
        <p className="mt-1 text-lg font-extrabold text-ink">{value}</p>
      </div>
    </div>
  );
}
