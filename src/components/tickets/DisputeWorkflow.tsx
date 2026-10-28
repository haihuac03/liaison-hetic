"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Undo2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { coreRequest, useCoreAuth } from "@/lib/client/core";
import type { Ticket } from "@/lib/types";
import { useUI } from "@/lib/ui";
import { formatWorkflowDate, rowStatus, rowText } from "./workflow";

type Row = Record<string, unknown>;

export default function DisputeWorkflow({ ticket }: { ticket: Ticket }) {
  const { core, refresh } = useCoreAuth();
  const { showToast } = useUI();
  const disputes = useMemo(
    () => ((core?.disputes || []) as unknown as Row[]).filter((item) => rowText(item, "ticket_id", "ticketId") === ticket.id).sort((a, b) => Number(rowText(b, "created_at", "createdAt")) - Number(rowText(a, "created_at", "createdAt"))),
    [core?.disputes, ticket.id],
  );
  const activeDispute = disputes.find((item) => ["open", "active", "en_litige"].includes(rowStatus(item)));
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const readOnly = ticket.status === "ferme" || ticket.status === "resolu";

  const submit = async () => {
    if (!description.trim()) {
      setError("Décrivez le désaccord.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await coreRequest("dispute/open", { ticketId: ticket.id, description: description.trim() });
      await refresh();
      setOpen(false);
      setDescription("");
      showToast("Litige signalé", "Le désaccord est ajouté à l’historique du dossier.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le signalement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (row: Row) => {
    setBusy(true);
    try {
      await coreRequest("dispute/withdraw", { disputeId: rowText(row, "id") });
      await refresh();
      showToast("Litige retiré", "Le dossier peut poursuivre son traitement.");
    } catch (cause) {
      showToast("Retrait impossible", cause instanceof Error ? cause.message : "Réessayez.", "warning");
    } finally {
      setBusy(false);
    }
  };

  if (!disputes.length && readOnly) return null;

  return (
    <section className="overflow-hidden rounded-card border border-peach/50 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-peach-soft/80 px-4 py-3">
        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-peach text-peach-dark"><AlertTriangle className="h-4 w-4" /></span><div><h2 className="font-headline text-[13px] font-bold text-ink">{activeDispute ? "Désaccord signalé" : "Désaccord & litige"}</h2><p className="mt-0.5 text-[8.5px] text-muted">Les échanges du dossier restent accessibles.</p></div></div>
        {!readOnly && !activeDispute && <button type="button" onClick={() => { setOpen(true); setError(""); }} className="btn-soft h-8 px-3 text-[8.5px]"><ArrowUpRight className="h-3 w-3" /> Signaler un litige</button>}
      </div>
      <div className="space-y-2 p-3.5">
        {disputes.map((row) => {
          const status = rowStatus(row);
          const canWithdraw = !readOnly && ["open", "active", "en_litige"].includes(status) && rowText(row, "opened_by") === core?.user.id;
          return <article key={rowText(row, "id")} className="rounded-xl border border-line bg-[#FBFAF6] p-3"><div className="flex items-start justify-between gap-2"><p className="text-[9.5px] leading-relaxed text-ink">{rowText(row, "description")}</p><span className="chip shrink-0 bg-white text-muted">{["withdrawn", "retire"] .includes(status) ? "Retiré" : ["resolved", "regle"].includes(status) ? "Réglé" : "En cours"}</span></div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-[8px] text-muted">{formatWorkflowDate(rowText(row, "created_at", "createdAt") || undefined)}</p>{canWithdraw && <button type="button" onClick={() => void withdraw(row)} disabled={busy} className="flex items-center gap-1 text-[8px] font-semibold text-muted hover:text-ink"><Undo2 className="h-3 w-3" />Retirer</button>}</div></article>;
        })}
      </div>
      <Modal open={open} onClose={() => !busy && setOpen(false)} className="max-w-[520px]" ariaLabel="Signaler un litige">
        <div className="p-5 sm:p-6"><h2 className="font-headline text-[16px] font-bold text-ink">Signaler un litige</h2><p className="mt-1 text-[9px] leading-relaxed text-muted">Décrivez précisément le point de désaccord et les faits constatés.</p><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="field mt-3 resize-none py-2.5 text-[10.5px]" placeholder="Description du désaccord" />{error && <p className="mt-2 rounded-lg bg-peach-soft px-3 py-2 text-[9px] text-peach-dark">{error}</p>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-soft h-9 px-3.5 text-[10px]">Annuler</button><button type="button" onClick={submit} disabled={busy} className="btn-dark h-9 px-4 text-[10px] disabled:opacity-60">{busy ? "Envoi…" : "Signaler"}</button></div></div>
      </Modal>
    </section>
  );
}
