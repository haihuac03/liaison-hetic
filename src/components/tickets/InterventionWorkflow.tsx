"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, CircleSlash2, ClipboardCheck, Plus, Wrench } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { coreRequest, useCoreAuth, type CoreIntervention } from "@/lib/client/core";
import type { Ticket } from "@/lib/types";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { formatCents, formatWorkflowDate, rowStatus, rowText } from "./workflow";

type Action = "propose" | "accept" | "refuse" | "complete" | "confirm" | "contest";

const ACTION_TITLES: Record<Action, string> = {
  propose: "Proposer une intervention",
  accept: "Accepter l’intervention",
  refuse: "Refuser l’intervention",
  complete: "Déclarer l’intervention réalisée",
  confirm: "Confirmer la réalisation",
  contest: "Contester la réalisation",
};

const isProposed = (status: string) => ["proposed", "pending", "open", "attente"].includes(status);
const isAccepted = (status: string) => ["accepted", "agreee", "acceptee"].includes(status);
const isCompleted = (status: string) => ["completed", "done", "realisee", "realise", "awaiting_confirmation"].includes(status);

export default function InterventionWorkflow({ ticket }: { ticket: Ticket }) {
  const { core, refresh } = useCoreAuth();
  const { showToast } = useUI();
  const rows = useMemo(
    () => (core?.interventions || []).filter((item) => item.ticket_id === ticket.id).sort((a, b) => b.created_at - a.created_at),
    [core?.interventions, ticket.id],
  );
  const [action, setAction] = useState<Action | null>(null);
  const [target, setTarget] = useState<CoreIntervention | null>(null);
  const [ticketVersion, setTicketVersion] = useState(ticket.version || 0);
  const [artisanName, setArtisanName] = useState("");
  const [details, setDetails] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const role = core?.user.role;
  const readOnly = ticket.status === "ferme" || ticket.status === "resolu";
  const hasOpenProposal = rows.some((item) => isProposed(rowStatus(item as unknown as Record<string, unknown>)));

  const open = (next: Action, row?: CoreIntervention) => {
    setAction(next);
    setTarget(row || null);
    setTicketVersion(ticket.version || 0);
    setArtisanName("");
    setDetails("");
    setScheduledStart("");
    setScheduledEnd("");
    setPrice("");
    setReason("");
    setReport("");
    setError("");
  };

  const execute = async (path: string, body: Record<string, unknown>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await coreRequest(path, body);
      await refresh();
      showToast("Intervention mise à jour", message);
      setAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La mise à jour a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!action) return;
    if (action === "propose") {
      if (!artisanName.trim() || !details.trim() || !scheduledStart || !scheduledEnd || !price.trim()) {
        setError("Renseignez le prestataire, les détails, le créneau et le coût.");
        return;
      }
      const start = new Date(scheduledStart).getTime();
      const end = new Date(scheduledEnd).getTime();
      const cents = Math.round(Number(price.replace(",", ".")) * 100);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        setError("Le créneau de fin doit être postérieur au début.");
        return;
      }
      if (!Number.isFinite(cents) || cents < 0) {
        setError("Indiquez un coût valide.");
        return;
      }
      await execute("intervention/propose", {
        ticketId: ticket.id,
        artisanName: artisanName.trim(),
        details: details.trim(),
        scheduledStart: start,
        scheduledEnd: end,
        priceCents: cents,
      }, "La proposition a été enregistrée.");
      return;
    }
    if (!target) return;
    if (action === "complete") {
      if (!report.trim()) {
        setError("Le compte rendu de réalisation est obligatoire.");
        return;
      }
      await execute("intervention/complete", { interventionId: target.id, report: report.trim(), expectedVersion: ticketVersion }, "Le compte rendu est transmis au locataire.");
      return;
    }
    if ((action === "refuse" || action === "contest") && !reason.trim()) {
      setError("Expliquez votre décision.");
      return;
    }
    if (action === "accept" || action === "refuse") {
      const decision = action === "accept" ? "accept" : "refuse";
      await execute("intervention/decide", { interventionId: target.id, decision, reason: reason.trim(), expectedVersion: ticketVersion }, decision === "accept" ? "Vous avez accepté la proposition." : "Votre réponse a été enregistrée.");
      return;
    }
    const decision = action === "confirm" ? "confirm" : "contest";
    await execute("intervention/confirm", { interventionId: target.id, decision, reason: reason.trim(), expectedVersion: ticketVersion }, decision === "confirm" ? "La réalisation est confirmée." : "Votre contestation a été enregistrée.");
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line/70 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-peach-soft text-peach-dark">
            <Wrench className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-headline text-[13px] font-bold text-ink">Interventions</h2>
            <p className="mt-0.5 text-[8.5px] text-muted">Propositions et décisions enregistrées dans le dossier</p>
          </div>
        </div>
        {role === "owner" && !readOnly && !hasOpenProposal && (
          <button type="button" onClick={() => open("propose")} className="btn-soft h-8 px-3 text-[9px]">
            <Plus className="h-3 w-3" /> Proposer
          </button>
        )}
      </div>

      <div className="space-y-2 p-3.5">
        {rows.length === 0 && (
          <p className="rounded-xl bg-cream-soft px-3 py-5 text-center text-[9.5px] text-muted">
            {role === "owner" && !readOnly ? "Aucune intervention proposée dans ce dossier." : "Le propriétaire n’a pas encore proposé d’intervention."}
          </p>
        )}
        {rows.map((row) => {
          const raw = row as unknown as Record<string, unknown>;
          const status = rowStatus(raw);
          return (
            <article key={row.id} className="rounded-xl border border-line bg-[#FBFAF6] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10.5px] font-bold text-ink">{`${row.artisan_name}`}</p>
                  <p className="mt-0.5 text-[8px] text-muted">Proposition #{row.id.slice(0, 8)}</p>
                </div>
                <span className={cn("chip", isAccepted(status) || status === "confirmed" ? "bg-sage-light text-sage-dark" : status === "contested" || status === "refused" ? "bg-peach text-peach-dark" : "bg-sky text-sky-dark")}>
                  {status === "proposed" || status === "pending" || status === "open" ? "À valider" : status === "accepted" ? "Acceptée" : status === "awaiting_confirmation" || status === "completed" ? "À confirmer" : status === "confirmed" ? "Confirmée" : status === "refused" ? "Refusée" : status === "contested" ? "Contestée" : "Enregistrée"}
                </span>
              </div>
              <p className="mt-2 text-[9.5px] leading-relaxed text-muted">{row.details}</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[7.5px] font-bold uppercase tracking-wide text-muted">Créneau</p>
                  <p className="mt-0.5 flex items-start gap-1 text-[8.5px] font-semibold text-ink"><CalendarClock className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted" />{formatWorkflowDate(row.scheduled_start)} → {formatWorkflowDate(row.scheduled_end)}</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-[7.5px] font-bold uppercase tracking-wide text-muted">Coût proposé</p>
                  <p className="mt-0.5 text-[9px] font-bold text-ink">{formatCents(row.price_cents)}</p>
                </div>
              </div>
              {row.report && <p className="mt-2 rounded-lg bg-sage-soft/60 p-2 text-[8.5px] leading-relaxed text-ink"><strong>Compte rendu :</strong> {row.report}</p>}
              {row.decision_reason && <p className="mt-2 text-[8px] leading-relaxed text-muted"><strong>Motif :</strong> {row.decision_reason}</p>}
              {!readOnly && role === "tenant" && isProposed(status) && (
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => open("accept", row)} className="btn-soft h-8 flex-1 text-[8.5px]" disabled={busy}><CheckCircle2 className="h-3 w-3" /> Accepter</button>
                  <button type="button" onClick={() => open("refuse", row)} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-white text-[8.5px] font-semibold text-muted hover:text-danger" disabled={busy}><CircleSlash2 className="h-3 w-3" /> Refuser</button>
                </div>
              )}
              {!readOnly && role === "owner" && (isAccepted(status) || status === "contested") && (
                <button type="button" onClick={() => open("complete", row)} className="btn-soft mt-2 h-8 w-full text-[8.5px]" disabled={busy}><ClipboardCheck className="h-3 w-3" /> {status === "contested" ? "Proposer une correction après contestation" : "Déclarer la réalisation"}</button>
              )}
              {!readOnly && role === "tenant" && isCompleted(status) && (
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => open("confirm", row)} className="btn-soft h-8 flex-1 text-[8.5px]" disabled={busy}><CheckCircle2 className="h-3 w-3" /> Confirmer</button>
                  <button type="button" onClick={() => open("contest", row)} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-white text-[8.5px] font-semibold text-muted hover:text-danger" disabled={busy}><CircleSlash2 className="h-3 w-3" /> Contester</button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <Modal open={Boolean(action)} onClose={() => !busy && setAction(null)} className="max-w-[620px]" ariaLabel={action ? ACTION_TITLES[action] : "Intervention"}>
        {action && (
          <div className="max-h-[90vh] overflow-y-auto">
            <div className="border-b border-line px-5 py-4 pr-14 sm:px-7">
              <h2 className="font-headline text-[16px] font-bold text-ink">{ACTION_TITLES[action]}</h2>
              <p className="mt-0.5 text-[9px] text-muted">Dossier #{ticket.id.slice(0, 8)}</p>
            </div>
            <div className="space-y-3 px-5 py-4 sm:px-7">
              {action === "propose" ? (
                <>
                  <Field label="Prestataire"><input value={artisanName} onChange={(e) => setArtisanName(e.target.value)} className="field mt-1 h-10 text-[10.5px]" placeholder="Nom ou société" /></Field>
                  <Field label="Détails de l’intervention"><textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className="field mt-1 resize-none py-2 text-[10.5px]" placeholder="Nature des travaux et éléments utiles" /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Début"><input type="datetime-local" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} className="field mt-1 h-10 text-[10px]" /></Field>
                    <Field label="Fin"><input type="datetime-local" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} className="field mt-1 h-10 text-[10px]" /></Field>
                  </div>
                  <Field label="Coût (€)"><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="field mt-1 h-10 text-[10.5px]" placeholder="0,00" /></Field>
                </>
              ) : action === "complete" ? (
                <Field label="Compte rendu de réalisation"><textarea value={report} onChange={(e) => setReport(e.target.value)} rows={5} className="field mt-1 resize-none py-2 text-[10.5px]" placeholder="Travaux réalisés, observations et suites éventuelles" /></Field>
              ) : (
                <Field label={action === "confirm" ? "Commentaire" : "Motif de la décision"}><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} className="field mt-1 resize-none py-2 text-[10.5px]" placeholder="Expliquez factuellement votre réponse" /></Field>
              )}
              {error && <p className="rounded-lg bg-peach-soft px-3 py-2 text-[9px] text-peach-dark">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setAction(null)} disabled={busy} className="btn-soft h-9 px-3.5 text-[10px]">Annuler</button>
                <button type="button" onClick={submit} disabled={busy} className="btn-sage h-9 px-4 text-[10px] disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[9px] font-bold text-ink">{label}{children}</label>;
}
