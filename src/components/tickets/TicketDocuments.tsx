"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Upload } from "lucide-react";
import DocumentCard, { type PreviewDoc } from "@/components/documents/DocumentCard";
import { uploadAttachments, useCoreAuth } from "@/lib/client/core";
import type { Attachment, Ticket } from "@/lib/types";
import { useUI } from "@/lib/ui";
import { fileKind, readFileAsDataUrl } from "@/lib/utils";

export default function TicketDocuments({ ticket, onPreview }: { ticket: Ticket; onPreview: (document: PreviewDoc) => void }) {
  const { refresh } = useCoreAuth();
  const { showToast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const closed = ticket.status === "ferme" || ticket.status === "resolu";

  const add = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const attachments: Attachment[] = [];
      for (const file of files.slice(0, 5)) {
        if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
          throw new Error("Formats acceptés : JPG, PNG, WebP ou PDF, jusqu’à 10 Mo par fichier.");
        }
        attachments.push({ src: await readFileAsDataUrl(file), alt: file.name, name: file.name, kind: fileKind(file.name) === "image" ? "image" : "file" });
      }
      await uploadAttachments(ticket.id, attachments);
      await refresh();
      showToast("Pièces ajoutées", "Les fichiers sont enregistrés dans le ticket.");
    } catch (cause) {
      showToast("Ajout impossible", cause instanceof Error ? cause.message : "Réessayez.", "warning");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-cream-soft text-petrol"><FileText className="h-3.5 w-3.5" /></span><div><h2 className="text-[11px] font-bold leading-tight text-ink">Documents liés</h2><p className="text-[8px] text-muted">{ticket.documents.length} pièce{ticket.documents.length > 1 ? "s" : ""}</p></div></div>
        <Link href="/documents" className="text-[8px] font-semibold text-sage hover:underline">Tout voir</Link>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {ticket.documents.slice(0, 4).map((document) => <DocumentCard key={document.id} document={document} onPreview={onPreview} />)}
        {ticket.documents.length === 0 && <p className="rounded-lg bg-cream-soft px-2.5 py-3 text-center text-[8.5px] text-muted">Aucune pièce jointe pour le moment.</p>}
      </div>
      {!closed && <><input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => { const files = Array.from(event.target.files || []); void add(files); event.target.value = ""; }} /><button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-[8.5px] font-semibold text-muted transition hover:border-sage/30 hover:bg-sage-soft/40 hover:text-sage-dark disabled:opacity-60">{busy ? <Upload className="h-3 w-3 animate-pulse" /> : <Plus className="h-3 w-3" />}{busy ? "Envoi…" : "Ajouter des pièces"}</button></>}
    </section>
  );
}
