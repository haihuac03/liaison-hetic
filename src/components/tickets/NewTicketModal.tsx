"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, FileText, Paperclip, Plus, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { CATEGORY_META } from "@/lib/meta";
import { useCoreAuth } from "@/lib/client/core";
import { useLiaison } from "@/lib/store";
import { useProperty } from "@/lib/property";
import { useUI } from "@/lib/ui";
import type { Attachment, TicketCategory } from "@/lib/types";
import { cn, fileKind, humanFileSize, readFileAsDataUrl } from "@/lib/utils";

const CATEGORY_ORDER: TicketCategory[] = ["reparation", "desaccord", "negociation", "contrat", "loyer", "logement", "autre"];
type AttachmentDraft = Attachment & { type: "image" | "file"; size: string };

export default function NewTicketModal() {
  const router = useRouter();
  const { newTicketOpen, newTicketPreset, closeNewTicket, showToast } = useUI();
  const { addTicket } = useLiaison();
  const { core, loading } = useCoreAuth();
  const { activeProperty, activePropertyId, setActiveProperty } = useProperty();
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const eligibleProperty = activeProperty && (core?.user.role === "owner" ? Boolean(activeProperty.tenant_id) : activeProperty.tenant_id === core?.user.id) ? activeProperty : null;
  const [propertyId, setPropertyId] = useState("");
  const [category, setCategory] = useState<TicketCategory>("reparation");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [error, setError] = useState("");
  const [createdTicketId, setCreatedTicketId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const recipient = core?.user.role === "owner" ? eligibleProperty?.tenant_name : eligibleProperty?.owner_name;

  useEffect(() => {
    if (!newTicketOpen) return;
    setCategory(newTicketPreset ?? "reparation");
    setTitle("");
    setDescription("");
    setAttachments([]);
    setError("");
    setCreatedTicketId("");
    setSubmitting(false);
    setPropertyId(eligibleProperty?.id || "");
    // Properties only need this reset when the dialog opens.
  }, [newTicketOpen, newTicketPreset, activePropertyId, eligibleProperty?.id]);

  const handleFiles = async (files: File[]) => {
    const next: AttachmentDraft[] = [];
    for (const file of files.slice(0, 5 - attachments.length)) {
      if (file.size === 0 || file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
        setError("Formats acceptés : JPG, PNG, WebP et PDF, jusqu’à 10 Mo par fichier.");
        return;
      }
      next.push({ src: await readFileAsDataUrl(file), alt: file.name, name: file.name, kind: fileKind(file.name) === "image" ? "image" : "file", type: fileKind(file.name) === "image" ? "image" : "file", size: humanFileSize(file.size) });
    }
    setAttachments((current) => [...current, ...next].slice(0, 5));
  };

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Le titre et la description sont obligatoires.");
      return;
    }
    if (!propertyId) {
      setError(core?.user.role === "owner" ? "Aucun logement avec locataire n’est disponible." : "Rejoignez un logement avant de créer un ticket.");
      return;
    }
    setError("");
    setCreatedTicketId("");
    setSubmitting(true);
    try {
      const ticket = await addTicket({
        propertyId,
        title: title.trim(),
        description: description.trim(),
        category,
        attachments: attachments.map(({ src, alt, name, kind }) => ({ src, alt, name, kind })),
      });
      closeNewTicket();
      if (propertyId) setActiveProperty(propertyId);
      showToast(`Ticket #${ticket.id} créé`, "Le dossier est partagé avec l’autre partie.");
      router.push(`/tickets/${ticket.id}`);
    } catch (cause) {
      const failedTicketId = cause && typeof cause === "object" && "ticketId" in cause ? String((cause as { ticketId?: unknown }).ticketId || "") : "";
      setCreatedTicketId(failedTicketId);
      setError(cause instanceof Error ? cause.message : "Création impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={newTicketOpen} onClose={closeNewTicket} className="max-w-[660px]" ariaLabel="Créer un nouveau ticket">
      <div className="max-h-[90vh] overflow-y-auto">
        <div className="border-b border-line px-5 py-4 pr-14 sm:px-7"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-petrol text-white"><Plus className="h-4 w-4" /></span><div><h2 className="font-headline text-[17px] font-bold tracking-[-0.02em] text-ink">{core?.user.role === "owner" ? "Créer un dossier" : "Signaler un problème"}</h2><p className="text-[9.5px] text-muted">Le dossier sera rattaché au logement sélectionné.</p></div></div></div>
        <div className="px-5 py-4 sm:px-7">
          <div className="rounded-xl border border-line bg-cream-soft px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">Logement du dossier</p>
            <p className="mt-1 text-[10.5px] font-bold text-ink">{activeProperty?.address || "Aucun logement actif"}</p>
            {!eligibleProperty && <p className="mt-1 text-[9px] text-peach-dark">{core?.user.role === "owner" ? "Ce logement doit d’abord être relié à un locataire." : "Ce logement n’est pas rattaché à votre compte."}</p>}
          </div>

          <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">Motif</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">{CATEGORY_ORDER.map((key) => { const meta = CATEGORY_META[key]; const Icon = meta.icon; const selected = category === key; return <button key={key} type="button" onClick={() => setCategory(key)} aria-pressed={selected} className={cn("relative flex min-h-[64px] flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-all", selected ? "border-petrol bg-petrol text-white" : "border-line bg-cream-soft text-ink hover:bg-white")}><span className={cn("flex h-6 w-6 items-center justify-center rounded-md", selected ? "bg-white/10 text-white" : "bg-white text-sage")}><Icon className="h-3 w-3" /></span><span className="text-[8.5px] font-bold leading-tight">{meta.label}</span>{selected && <Check className="absolute right-2 top-2 h-3 w-3 text-white/70" />}</button>; })}</div>

          <label htmlFor="ticket-title" className="mt-4 block text-[9.5px] font-bold text-ink">Titre <span className="text-danger">*</span><input id="ticket-title" autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setError(""); }} placeholder="Ex. Fuite sous l’évier" className={cn("field mt-1.5 h-10 text-[11px]", error && !title && "border-danger/50")} /></label>
          <label htmlFor="ticket-description" className="mt-3 block text-[9.5px] font-bold text-ink">Description <span className="text-danger">*</span><textarea id="ticket-description" value={description} onChange={(event) => { setDescription(event.target.value); setError(""); }} rows={4} placeholder="Décrivez les faits, la date et les pièces concernées." className={cn("field mt-1.5 resize-none py-2.5 text-[11px] leading-relaxed", error && !description && "border-danger/50")} /></label>

          <div className="mt-3"><p className="text-[9.5px] font-bold text-ink">Pièces jointes</p><div className="mt-1.5 grid grid-cols-2 gap-1.5"><button type="button" onClick={() => photoInput.current?.click()} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-cream-soft text-[9.5px] font-semibold text-ink hover:bg-white"><Camera className="h-3.5 w-3.5 text-sage" />Photo</button><button type="button" onClick={() => docInput.current?.click()} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-cream-soft text-[9.5px] font-semibold text-ink hover:bg-white"><Paperclip className="h-3.5 w-3.5 text-sage" />Document</button></div><input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length) void handleFiles(files); event.target.value = ""; }} /><input ref={docInput} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); if (files.length) void handleFiles(files); event.target.value = ""; }} /></div>
          {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{attachments.map((attachment) => <span key={`${attachment.name}-${attachment.src.slice(-8)}`} className="flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1 text-[9px] text-ink">{attachment.type === "image" ? <img src={attachment.src} alt="" className="h-5 w-5 rounded object-cover" /> : <FileText className="h-3 w-3 text-petrol" />}<span className="max-w-[140px] truncate">{attachment.name}</span><span className="text-[8px] text-muted">{attachment.size}</span><button type="button" aria-label={`Retirer ${attachment.name}`} onClick={() => setAttachments((current) => current.filter((item) => item !== attachment))} className="text-muted hover:text-danger"><X className="h-3 w-3" /></button></span>)}</div>}

          <div className="mt-3 rounded-xl border border-line/70 bg-cream-soft px-3 py-2.5 text-[9px] leading-relaxed text-muted">{!eligibleProperty ? "La création nécessite un logement actif relié aux deux parties." : `Le dossier sera partagé avec ${recipient || "l’autre partie"} pour ${activeProperty?.address || "ce logement"}.`}</div>
          {error && <div className="mt-2 rounded-lg bg-peach-soft px-3 py-2 text-[9px] text-peach-dark"><p>{error}</p>{createdTicketId && <Link href={`/tickets/${createdTicketId}`} className="mt-1 inline-block font-bold underline">Ouvrir le ticket créé</Link>}</div>}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white/95 px-5 py-3.5 backdrop-blur sm:px-7"><button type="button" onClick={closeNewTicket} className="btn-soft h-9 px-3.5 text-[10.5px]">Annuler</button><button type="button" onClick={submit} disabled={submitting || loading || !eligibleProperty} className="btn-dark h-9 px-4 text-[10.5px] disabled:opacity-60">{submitting ? "Création…" : core?.user.role === "owner" ? "Créer le dossier" : "Envoyer la demande"}</button></div>
      </div>
    </Modal>
  );
}
