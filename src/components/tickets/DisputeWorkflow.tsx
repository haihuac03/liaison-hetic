"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, ExternalLink, Mail, Phone, Scale, Undo2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { coreRequest, useCoreAuth } from "@/lib/client/core";
import { legalResourcesFor, type LegalResource } from "@/lib/legal-resources";
import { useProperty } from "@/lib/property";
import type { Ticket } from "@/lib/types";
import { useUI } from "@/lib/ui";
import { formatWorkflowDate, rowStatus, rowText } from "./workflow";

type Row = Record<string, unknown>;

export default function DisputeWorkflow({ ticket }: { ticket: Ticket }) {
  const { core, refresh } = useCoreAuth();
  const { activeProperty } = useProperty();
  const { showToast } = useUI();
  const disputes = useMemo(
    () => ((core?.disputes || []) as unknown as Row[]).filter((item) => rowText(item, "ticket_id", "ticketId") === ticket.id).sort((a, b) => Number(rowText(b, "created_at", "createdAt")) - Number(rowText(a, "created_at", "createdAt"))),
    [core?.disputes, ticket.id],
  );
  const activeDispute = disputes.find((item) => ["open", "active", "en_litige"].includes(rowStatus(item)));
  const legalResources = useMemo(
    () => legalResourcesFor(activeProperty?.address || ticket.address),
    [activeProperty?.address, ticket.address],
  );
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const readOnly = ticket.status === "ferme" || ticket.status === "resolu";

  const legalMailto = (resource: LegalResource) => {
    if (!resource.email) return resource.contactUrl;
    const subject = `Litige locatif — dossier LIAISON #${ticket.id.slice(0, 8)}`;
    const body = [
      "Bonjour,",
      "Je souhaite obtenir une information juridique sur le litige locatif décrit ci-dessous.",
      `Dossier : #${ticket.id.slice(0, 8)}\nLogement : ${activeProperty?.address || ticket.address || "Non renseigné"}\nObjet : ${ticket.title}`,
      `Description du dossier :\n${ticket.description}`,
      `Point de désaccord :\n${rowText(activeDispute || {}, "description")}`,
      "Je peux vous transmettre les échanges et les pièces utiles à l’étude du dossier.",
      "Merci d’avance pour votre aide.",
    ].join("\n\n");
    return `mailto:${resource.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

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
      {activeDispute && (
        <div className="border-t border-peach/40 bg-[#FCF8F1] p-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-petrol shadow-sm"><Scale className="h-4 w-4" /></span>
            <div>
              <h3 className="font-headline text-[12px] font-bold text-ink">Besoin d’un conseil juridique ?</h3>
              <p className="mt-0.5 text-[8.5px] leading-relaxed text-muted">Ces services officiels peuvent vous informer sur vos droits. Ils ne font pas partie du dossier LIAISON et n’y ont pas accès automatiquement.</p>
            </div>
          </div>
          <div className={`mt-3 grid gap-2 ${legalResources.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {legalResources.map((resource) => {
              const mailLink = legalMailto(resource);
              return (
                <article key={resource.id} className="rounded-xl border border-line/80 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-[10px] font-bold text-ink">{resource.name}</p><p className="mt-0.5 text-[8px] leading-relaxed text-muted">{resource.description}</p></div>
                    <span className="chip shrink-0 bg-cream-soft text-muted">{resource.scope}</span>
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    <a href={`tel:${resource.phoneHref}`} className="flex items-center gap-2 text-[9px] font-semibold text-petrol hover:underline"><Phone className="h-3 w-3 shrink-0" />{resource.phone}</a>
                    {resource.email ? (
                      <a href={mailLink} className="flex items-center gap-2 break-all text-[9px] font-semibold text-petrol hover:underline"><Mail className="h-3 w-3 shrink-0" />{resource.email}</a>
                    ) : (
                      <p className="flex items-center gap-2 text-[8.5px] text-muted"><Mail className="h-3 w-3 shrink-0" />Contact par formulaire officiel</p>
                    )}
                  </div>
                  <a href={mailLink} target={resource.email ? undefined : "_blank"} rel={resource.email ? undefined : "noreferrer"} className="mt-3 flex items-center gap-1.5 text-[8.5px] font-bold text-petrol hover:underline">
                    {resource.email ? "Écrire avec le résumé du dossier" : "Ouvrir le formulaire officiel"}<ExternalLink className="h-3 w-3" />
                  </a>
                </article>
              );
            })}
          </div>
          <p className="mt-3 text-[8px] leading-relaxed text-muted">Le lien e-mail ouvre votre messagerie avec les faits du litige préremplis. Le message n’est envoyé qu’après votre validation.</p>
        </div>
      )}
      <Modal open={open} onClose={() => !busy && setOpen(false)} className="max-w-[520px]" ariaLabel="Signaler un litige">
        <div className="p-5 sm:p-6"><h2 className="font-headline text-[16px] font-bold text-ink">Signaler un litige</h2><p className="mt-1 text-[9px] leading-relaxed text-muted">Décrivez précisément le point de désaccord et les faits constatés.</p><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="field mt-3 resize-none py-2.5 text-[10.5px]" placeholder="Description du désaccord" />{error && <p className="mt-2 rounded-lg bg-peach-soft px-3 py-2 text-[9px] text-peach-dark">{error}</p>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-soft h-9 px-3.5 text-[10px]">Annuler</button><button type="button" onClick={submit} disabled={busy} className="btn-dark h-9 px-4 text-[10px] disabled:opacity-60">{busy ? "Envoi…" : "Signaler"}</button></div></div>
      </Modal>
    </section>
  );
}
