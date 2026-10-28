"use client";

import { ArrowDownToLine, FileText, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useUI } from "@/lib/ui";
import { downloadFile } from "@/lib/utils";
import type { PreviewDoc } from "./DocumentCard";

export default function DocumentPreviewModal({
  document,
  open,
  onClose,
}: {
  document: PreviewDoc | null;
  open: boolean;
  onClose: () => void;
}) {
  const { showToast } = useUI();
  if (!document) return null;

  return (
    <Modal open={open} onClose={onClose} className="max-w-[880px]" ariaLabel={`Aperçu de ${document.name}`}>
      <div className="grid max-h-[88vh] grid-cols-1 overflow-y-auto md:grid-cols-[1.2fr_1fr]">
        <div className="flex items-center justify-center border-b border-line bg-cream-soft p-4 md:border-b-0 md:border-r">
          {document.type === "pdf" ? (
            <iframe src={document.preview} title={document.name} className="h-[70vh] w-full rounded-xl border border-line bg-white shadow-soft" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={document.preview} alt={document.name} className="max-h-[70vh] w-full rounded-xl border border-line bg-white object-contain shadow-soft" />
          )}
        </div>
        <div className="p-5">
          <span className="chip bg-sage-light text-sage-dark">
            <ShieldCheck className="h-2.5 w-2.5" />
            Document enregistré
          </span>
          <h2 className="mt-2.5 font-headline text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink">
            {document.name}
          </h2>
          <p className="mt-1 text-[10px] text-muted">
            {document.size} · Ajouté le {document.date}
          </p>
          {"description" in document && document.description && (
            <p className="mt-3 text-[10.5px] leading-relaxed text-muted">{document.description}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-cream-soft p-2.5">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-muted">Type</p>
              <p className="mt-0.5 text-[10px] font-bold text-ink">
                {document.type === "pdf" ? "Document PDF" : "Photographie"}
              </p>
            </div>
            <div className="rounded-xl bg-cream-soft p-2.5">
              <p className="text-[8px] font-semibold uppercase tracking-wide text-muted">Horodatage</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-sage">
                <ShieldCheck className="h-3 w-3" />
                Fichier disponible
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              downloadFile(document.preview, document.name);
              showToast("Téléchargement lancé", document.name);
            }}
            className="btn-dark mt-3 h-9 w-full text-[10.5px]"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Télécharger le document
          </button>

          <p className="mt-3 rounded-xl bg-cream-soft p-3 text-[9px] leading-relaxed text-muted">
            L’aperçu affiche le fichier enregistré. LIAISON n’extrait pas automatiquement son contenu.
          </p>
        </div>
      </div>
    </Modal>
  );
}
