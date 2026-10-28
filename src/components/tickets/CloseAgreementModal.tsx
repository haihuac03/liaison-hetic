"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Handshake, Paperclip, Upload, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { coreRequest, uploadAttachments, useCoreAuth, type CoreState } from "@/lib/client/core";
import type { Attachment, Ticket } from "@/lib/types";
import { useUI } from "@/lib/ui";
import { cn, fileKind, readFileAsDataUrl } from "@/lib/utils";

type UploadDraft = Attachment & { size: number };

export default function CloseAgreementModal({ ticket, open, onClose }: { ticket: Ticket; open: boolean; onClose: () => void }) {
  const { core, refresh } = useCoreAuth();
  const { showToast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState(ticket.title);
  const [conditions, setConditions] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [uploads, setUploads] = useState<UploadDraft[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(ticket.title);
    setConditions("");
    setAmount("");
    setSelectedDocuments([]);
    setUploads([]);
    setError("");
    setSubmitting(false);
  }, [open, ticket.id, ticket.title]);

  const addFiles = async (files: File[]) => {
    const next: UploadDraft[] = [];
    for (const file of files.slice(0, 5 - uploads.length)) {
      if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
        setError("Formats acceptés : JPG, PNG, WebP ou PDF, jusqu’à 10 Mo par fichier.");
        return;
      }
      next.push({ src: await readFileAsDataUrl(file), alt: file.name, name: file.name, kind: fileKind(file.name) === "image" ? "image" : "file", size: file.size });
    }
    setUploads((current) => [...current, ...next].slice(0, 5));
  };

  const submit = async () => {
    if (!subject.trim() || !conditions.trim()) {
      setError("Renseignez l’objet et les conditions de la clôture.");
      return;
    }
    const amountNumber = amount.trim() ? Number(amount.replace(",", ".")) : null;
    if (amountNumber !== null && (!Number.isFinite(amountNumber) || amountNumber < 0)) {
      setError("Indiquez un montant valide.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const before = new Set((core?.files || []).map((file) => file.id));
      if (uploads.length) await uploadAttachments(ticket.id, uploads);
      const fileIds = [...selectedDocuments];
      if (uploads.length) {
        const current = await coreRequest<CoreState>("state");
        fileIds.push(...current.files.filter((file) => file.ticket_id === ticket.id && !before.has(file.id)).map((file) => file.id));
      }
      await coreRequest("closure/request", {
        ticketId: ticket.id,
        subject: subject.trim(),
        conditions: conditions.trim(),
        ...(fileIds.length ? { fileIds: Array.from(new Set(fileIds)) } : {}),
        ...(amountNumber !== null ? { amountCents: Math.round(amountNumber * 100) } : {}),
        ...(typeof ticket.version === "number" ? { expectedVersion: ticket.version } : {}),
      });
      await refresh();
      showToast("Demande de clôture envoyée", "L’autre partie doit maintenant l’accepter.");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La demande de clôture a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => !submitting && onClose()} className="max-w-[700px]" ariaLabel="Demander la clôture du dossier">
      <div className="max-h-[90vh] overflow-y-auto">
        <div className="border-b border-line px-5 py-4 pr-14 sm:px-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-sage text-white"><Handshake className="h-4 w-4" /></span>
            <div><h2 className="font-headline text-[17px] font-bold tracking-[-0.02em] text-ink">Proposer la clôture</h2><p className="text-[9.5px] text-muted">Dossier #{ticket.id.slice(0, 8)} · l’envoi vaut accord de son auteur</p></div>
          </div>
        </div>
        <div className="space-y-3 px-5 py-4 sm:px-7">
          <label className="block text-[9.5px] font-bold text-ink">Objet <span className="text-danger">*</span><input value={subject} onChange={(event) => setSubject(event.target.value)} className="field mt-1.5 h-10 text-[10.5px]" /></label>
          <label className="block text-[9.5px] font-bold text-ink">Conditions <span className="text-danger">*</span><textarea value={conditions} onChange={(event) => setConditions(event.target.value)} rows={4} className="field mt-1.5 resize-none py-2.5 text-[10.5px] leading-relaxed" placeholder="Décrivez les engagements et la solution proposée" /></label>
          <label className="block text-[9.5px] font-bold text-ink">Montant indicatif (€, facultatif)<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="field mt-1.5 h-10 text-[10.5px]" placeholder="Laisser vide si sans contrepartie" /></label>
          <div>
            <div className="flex items-center justify-between gap-2"><p className="text-[9.5px] font-bold text-ink">Pièces du dossier</p><button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-[8.5px] font-semibold text-sage"><Paperclip className="h-3 w-3" />Joindre un fichier</button></div>
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length) void addFiles(files); event.target.value = ""; }} />
            {ticket.documents.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{ticket.documents.map((document) => { const checked = selectedDocuments.includes(document.id); return <button key={document.id} type="button" onClick={() => setSelectedDocuments((current) => checked ? current.filter((id) => id !== document.id) : [...current, document.id])} className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[8px] font-semibold", checked ? "border-sage bg-sage-soft text-sage-dark" : "border-line bg-white text-muted")}><FileText className="h-3 w-3" />{document.name}</button>; })}</div>}
            {uploads.length > 0 && <div className="mt-1.5 space-y-1">{uploads.map((upload) => <div key={upload.name} className="flex items-center gap-2 rounded-lg bg-cream-soft px-2 py-1.5 text-[8.5px] text-ink"><Upload className="h-3 w-3 text-sage" /><span className="min-w-0 flex-1 truncate">{upload.name}</span><button type="button" onClick={() => setUploads((current) => current.filter((item) => item.name !== upload.name))} aria-label={`Retirer ${upload.name}`} className="text-muted hover:text-danger"><X className="h-3 w-3" /></button></div>)}</div>}
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-cream-soft p-3 text-[8.5px] leading-relaxed text-muted"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />La création de la demande vaut accord de son auteur. La clôture ne devient effective qu’après la décision de l’autre partie.</div>
          {error && <p className="rounded-lg bg-peach-soft px-3 py-2 text-[9px] font-medium text-peach-dark">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white/95 px-5 py-3.5 backdrop-blur sm:px-7"><button type="button" onClick={onClose} disabled={submitting} className="btn-soft h-9 px-3.5 text-[10.5px]">Annuler</button><button type="button" onClick={submit} disabled={submitting} className="btn-sage h-9 px-4 text-[10.5px] disabled:opacity-60">{submitting ? "Envoi…" : "Envoyer la demande"}</button></div>
      </div>
    </Modal>
  );
}
