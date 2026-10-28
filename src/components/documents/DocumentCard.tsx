"use client";

import { ArrowDownToLine, Eye, FileText, ImageIcon } from "lucide-react";
import { useUI } from "@/lib/ui";
import { cn, downloadFile } from "@/lib/utils";
import type { DocumentItem, LinkedDocument } from "@/lib/types";

export type PreviewDoc = DocumentItem | LinkedDocument;

export default function DocumentCard({
  document,
  variant = "row",
  onPreview,
}: {
  document: PreviewDoc;
  variant?: "row" | "grid";
  onPreview?: (document: PreviewDoc) => void;
}) {
  const { showToast } = useUI();
  const isImage = document.type === "image";

  const download = () => {
    downloadFile(document.preview, document.name);
    showToast("Téléchargement lancé", document.name);
  };

  if (variant === "grid") {
    return (
      <article className="card group overflow-hidden p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
        <button
          type="button"
          onClick={() => onPreview?.(document)}
          className="relative block h-[132px] w-full overflow-hidden bg-cream-soft"
          aria-label={`Aperçu de ${document.name}`}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={document.preview} alt={document.name} className="h-full w-full object-cover object-top transition duration-700 group-hover:scale-[1.03]" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-cream-soft text-[#B35C45]"><FileText className="h-8 w-8" /><span className="text-[9px] font-bold uppercase tracking-wide">PDF</span></span>
          )}
          <span className="absolute left-2 top-2 chip bg-white/95 text-ink shadow-sm">
            <FileText className="h-2.5 w-2.5 text-sage" />
            {"category" in document ? document.category : "Document"}
          </span>
          <span className="absolute inset-0 flex items-center justify-center bg-petrol/0 opacity-0 transition group-hover:bg-petrol/10 group-hover:opacity-100">
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-white/95 px-3 text-[9px] font-bold text-petrol shadow-sm">
              <Eye className="h-3 w-3" />
              Aperçu
            </span>
          </span>
        </button>
        <div className="p-3">
          <p className="truncate text-[10.5px] font-bold text-ink">{document.name}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[8.5px] text-muted">
            <span>{document.size}</span>
            <span>·</span>
            <span>{document.date}</span>
            {document.status && (
              <span className="ml-auto chip bg-sage-light text-sage-dark">{document.status}</span>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <button type="button" onClick={() => onPreview?.(document)} className="btn-soft h-8 flex-1 text-[9px]">
              <Eye className="h-3 w-3" />
              Ouvrir
            </button>
            <button type="button" onClick={download} className="icon-btn h-8 w-8 rounded-lg" aria-label="Télécharger">
              <ArrowDownToLine className="h-3 w-3" />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-xl bg-cream-soft p-2 transition hover:bg-[#F1F0EA]">
      <button
        type="button"
        onClick={() => onPreview?.(document)}
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-white shadow-sm",
          isImage ? "text-sky-dark" : "text-[#B35C45]",
        )}
        aria-label={`Aperçu de ${document.name}`}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={document.preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </button>
      <button type="button" onClick={() => onPreview?.(document)} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[9.5px] font-bold leading-tight text-ink">{document.name}</p>
        <p className="mt-0.5 truncate text-[8px] text-muted">
          {document.size} · {document.date}
          {document.status ? ` · ${document.status}` : ""}
        </p>
      </button>
      <button
        type="button"
        onClick={download}
        className="icon-btn h-7 w-7 shrink-0 rounded-lg"
        aria-label={`Télécharger ${document.name}`}
      >
        <ArrowDownToLine className="h-3 w-3" />
      </button>
    </div>
  );
}
