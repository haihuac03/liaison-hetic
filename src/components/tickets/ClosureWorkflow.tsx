"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Handshake, RotateCcw, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { coreRequest, useCoreAuth } from "@/lib/client/core";
import type { Ticket } from "@/lib/types";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { formatCents, formatWorkflowDate, parseFileIds, rowNumber, rowStatus, rowText, rowValue } from "./workflow";

type Row = Record<string, unknown>;

export default function ClosureWorkflow({ ticket, onCreate }: { ticket: Ticket; onCreate: () => void }) {
  const { core, refresh } = useCoreAuth();
  const { showToast } = useUI();
  const closures = useMemo(
    () => ((core?.closures || []) as unknown as Row[]).filter((item) => rowText(item, "ticket_id", "ticketId") === ticket.id).sort((a, b) => (rowNumber(b, "created_at", "createdAt") || 0) - (rowNumber(a, "created_at", "createdAt") || 0)),
    [core?.closures, ticket.id],
  );
  const agreements = useMemo(
    () => ((core?.agreements || []) as unknown as Row[]).filter((item) => rowText(item, "ticket_id", "ticketId") === ticket.id),
    [core?.agreements, ticket.id],
  );
  const [decision, setDecision] = useState<"accept" | "refuse" | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [selectedTicketVersion, setSelectedTicketVersion] = useState(ticket.version || 0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const userId = core?.user.id;
  const readOnly = ticket.status === "ferme" || ticket.status === "resolu";
  const latest = closures[0];
  const pending = latest && ["pending", "open", "en_attente", "en_cloture"].includes(rowStatus(latest));

  const choose = (row: Row, next: "accept" | "refuse") => {
    setSelected(row);
    setSelectedTicketVersion(ticket.version || 0);
    setDecision(next);
    setReason("");
    setError("");
  };

  const submit = async () => {
    if (!selected || !decision) return;
    if (decision === "refuse" && !reason.trim()) {
      setError("Indiquez le motif du refus.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await coreRequest("closure/decide", {
        requestId: rowText(selected, "id", "request_id"),
        decision,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        expectedVersion: selectedTicketVersion,
      });
      await refresh();
      setDecision(null);
      showToast(decision === "accept" ? "Clôture acceptée" : "Demande refusée", decision === "accept" ? "Le ticket est maintenant fermé." : "Vous pouvez proposer une nouvelle demande.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La réponse n’a pas pu être enregistrée.");
    } finally {
      setBusy(false);
    }
  };

  if (!closures.length && !agreements.length && ticket.status !== "en_cloture" && ticket.status !== "ferme") return null;

  return (
    <section className="overflow-hidden rounded-card border border-sage/25 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-sage-soft px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sage text-white"><Handshake className="h-4 w-4" /></span>
          <div><h2 className="font-headline text-[13px] font-bold text-sage-dark">{readOnly ? "Accord enregistré" : "Clôture du ticket"}</h2><p className="mt-0.5 text-[8.5px] text-muted">{readOnly ? "Le ticket est en lecture seule." : "La demande doit être acceptée par l’autre partie."}</p></div>
        </div>
        {!readOnly && latest && ((pending && rowText(latest, "requester_id", "proposer_id") === userId) || (!pending && ["refused", "declined", "replaced"].includes(rowStatus(latest)))) && <button type="button" onClick={onCreate} className="btn-soft h-8 px-3 text-[8.5px]"><RotateCcw className="h-3 w-3" /> {pending ? "Modifier ma demande" : "Remplacer la demande"}</button>}
      </div>

      <div className="space-y-2 p-3.5">
        {latest && (
          <article className="rounded-xl border border-line bg-[#FBFAF6] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0"><p className="text-[10.5px] font-bold text-ink">{rowText(latest, "subject") || ticket.title}</p><p className="mt-0.5 text-[8px] text-muted">Demande #{rowText(latest, "id").slice(0, 8)} · {formatWorkflowDate(rowText(latest, "created_at", "createdAt") || undefined)}</p></div>
              <span className={cn("chip", rowStatus(latest) === "accepted" ? "bg-sage-light text-sage-dark" : rowStatus(latest) === "refused" || rowStatus(latest) === "replaced" ? "bg-peach text-peach-dark" : "bg-sky text-sky-dark")}>{rowStatus(latest) === "accepted" ? "Accordée" : rowStatus(latest) === "refused" ? "Refusée" : rowStatus(latest) === "replaced" ? "Remplacée" : "À confirmer"}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[9.5px] leading-relaxed text-muted">{rowText(latest, "conditions")}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-white p-2"><p className="text-[7.5px] font-bold uppercase tracking-wide text-muted">Montant</p><p className="mt-0.5 text-[9px] font-bold text-ink">{rowNumber(latest, "amount_cents", "amountCents") === null ? "Sans montant" : formatCents(rowNumber(latest, "amount_cents", "amountCents"))}</p></div>
              <div className="rounded-lg bg-white p-2"><p className="text-[7.5px] font-bold uppercase tracking-wide text-muted">Auteur</p><p className="mt-0.5 text-[9px] font-bold text-ink">{rowText(latest, "requester_id", "proposer_id") === userId ? "Vous" : ticket.correspondentRole || "L’autre partie"}</p></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip bg-sage-light text-sage-dark"><CheckCircle2 className="h-2.5 w-2.5" />Accord de l’auteur à la création</span>
              {rowStatus(latest) === "accepted" && <span className="chip bg-sage-light text-sage-dark"><CheckCircle2 className="h-2.5 w-2.5" />Acceptée par l’autre partie</span>}
              {parseFileIds(rowValue(latest, "file_ids", "fileIds")).map((id) => { const document = ticket.documents.find((item) => item.id === id); return <span key={id} className="chip bg-white text-muted"><FileText className="h-2.5 w-2.5" />{document?.name || `Pièce ${id.slice(0, 8)}`}</span>; })}
            </div>
            {rowText(latest, "decision_reason", "reason") && <p className="mt-2 rounded-lg bg-peach-soft/70 px-2.5 py-2 text-[8.5px] leading-relaxed text-peach-dark"><strong>Motif :</strong> {rowText(latest, "decision_reason", "reason")}</p>}
            {!readOnly && pending && rowText(latest, "requester_id", "proposer_id") !== userId && (
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => choose(latest, "accept")} className="btn-sage h-8 flex-1 text-[8.5px]" disabled={busy}><CheckCircle2 className="h-3 w-3" /> Accepter la clôture</button>
                <button type="button" onClick={() => choose(latest, "refuse")} className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-line bg-white text-[8.5px] font-semibold text-muted hover:text-danger" disabled={busy}><XCircle className="h-3 w-3" /> Refuser</button>
              </div>
            )}
          </article>
        )}
        {agreements.map((agreement) => (
          <article key={rowText(agreement, "id")} className="rounded-xl border border-sage/20 bg-sage-soft/40 p-3">
            <p className="text-[10px] font-bold text-sage-dark">Accord enregistré · {rowText(agreement, "subject") || rowText(agreement, "id").slice(0, 8)}</p>
            <p className="mt-1 whitespace-pre-wrap text-[8.5px] leading-relaxed text-muted">{rowText(agreement, "conditions")}</p>
            <p className="mt-1.5 text-[8px] text-muted">Accepté par {rowText(agreement, "accepted_by", "responder_id") === userId ? "vous" : "l’autre partie"} le {formatWorkflowDate(rowText(agreement, "created_at", "responder_accepted_at", "accepted_at") || undefined)}</p>
          </article>
        ))}
      </div>

      <Modal open={Boolean(decision)} onClose={() => !busy && setDecision(null)} className="max-w-[520px]" ariaLabel="Répondre à la demande de clôture">
        {decision && <div className="p-5 sm:p-6"><h2 className="font-headline text-[16px] font-bold text-ink">{decision === "accept" ? "Accepter la clôture" : "Refuser la demande"}</h2><p className="mt-1 text-[9px] leading-relaxed text-muted">L’acceptation ferme le ticket. Le refus doit pouvoir être compris par l’autre partie.</p><label className="mt-3 block text-[9px] font-bold text-ink">Motif {decision === "refuse" ? <span className="text-danger">*</span> : <span className="font-normal text-muted">(facultatif)</span>}<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="field mt-1 resize-none py-2 text-[10px]" /></label>{error && <p className="mt-2 rounded-lg bg-peach-soft px-3 py-2 text-[9px] text-peach-dark">{error}</p>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setDecision(null)} disabled={busy} className="btn-soft h-9 px-3.5 text-[10px]">Annuler</button><button type="button" onClick={submit} disabled={busy} className={cn("h-9 px-4 text-[10px] disabled:opacity-60", decision === "accept" ? "btn-sage" : "btn-dark")}>{busy ? "Enregistrement…" : "Confirmer"}</button></div></div>}
      </Modal>
    </section>
  );
}
