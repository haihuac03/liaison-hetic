"use client";

import { useRef, useState } from "react";
import { Download, FileText, Upload } from "lucide-react";
import { coreRequest } from "@/lib/client/core";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  documentMimeFor,
} from "@/lib/document-files";
import {
  documentCreatedAt,
  documentName,
  formatLongDate,
  type PropertyDocumentRecord,
} from "./lease-types";

function validateFile(file: File): string | null {
  if (!documentMimeFor(file.name, file.type)) {
    return `${file.name} : seuls les formats PDF, JPEG, PNG et WebP sont acceptés.`;
  }
  if (file.size === 0) return `${file.name} est vide.`;
  if (file.size > DOCUMENT_MAX_BYTES) return `${file.name} dépasse la limite de 10 Mo.`;
  return null;
}

function diskName() {
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}

export default function ContractDocuments({
  propertyId,
  leaseId,
  documents,
  canUpload,
  onUploaded,
}: {
  propertyId: string;
  leaseId: string;
  documents: PropertyDocumentRecord[];
  canUpload: boolean;
  onUploaded: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setSuccess("");

    const selected = Array.from(files);
    if (selected.length > 5) {
      setError("Ajoutez au maximum 5 documents à la fois.");
      return;
    }
    const validationError = selected.map(validateFile).find(Boolean);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    try {
      const uploadMode = await coreRequest<{ direct: boolean }>("lease-upload");
      if (uploadMode.direct) {
        const { uploadPresigned } = await import("@vercel/blob/client");
        const uploaded: { diskName: string; name: string; mime: string; size: number }[] = [];
        for (const file of selected) {
          const mime = documentMimeFor(file.name, file.type);
          if (!mime) throw new Error(`${file.name} : format non reconnu.`);
          const uploadedDiskName = diskName();
          await uploadPresigned(`liaison/${uploadedDiskName}`, file, {
            access: "private",
            handleUploadUrl: "/api/lease-upload",
            clientPayload: JSON.stringify({
              propertyId,
              leaseId,
              name: file.name,
              mime,
              size: file.size,
            }),
            contentType: mime,
            multipart: file.size > 4 * 1024 * 1024,
          });
          uploaded.push({ diskName: uploadedDiskName, name: file.name, mime, size: file.size });
        }
        await coreRequest("lease-upload-complete", { propertyId, leaseId, files: uploaded });
      } else {
        const form = new FormData();
        form.set("propertyId", propertyId);
        form.set("leaseId", leaseId);
        for (const file of selected) {
          const mime = documentMimeFor(file.name, file.type);
          if (!mime) throw new Error(`${file.name} : format non reconnu.`);
          form.append("files", mime === file.type ? file : new File([file], file.name, { type: mime }), file.name);
        }

        const response = await fetch("/api/core/lease-upload", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          body: form,
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "L'envoi des documents a échoué.");
      }

      await onUploaded();
      setSuccess(
        selected.length > 1
          ? `${selected.length} documents ont été ajoutés.`
          : "Le document a été ajouté.",
      );
      if (inputRef.current) inputRef.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "L'envoi des documents a échoué.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Pièces du logement</p>
          <h2 className="mt-1 font-headline text-[18px] font-bold text-ink">Documents</h2>
          <p className="mt-1 text-xs text-muted">
            Bail, états des lieux, diagnostics et autres pièces partagées.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={DOCUMENT_ACCEPT}
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
          />
          <button
            type="button"
            disabled={!canUpload || uploading || !leaseId}
            onClick={() => inputRef.current?.click()}
            className="btn-dark h-10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Envoi…" : "Ajouter des documents"}
          </button>
        </div>
      </div>

      {!canUpload && leaseId && (
        <p className="mt-3 rounded-xl bg-cream-soft px-3 py-2 text-xs text-muted">
          Vous pouvez déposer des pièces sur le bail. Elles seront visibles par les deux parties.
        </p>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p role="status" className="mt-3 rounded-xl bg-sage-soft px-3 py-2 text-xs text-sage-dark">{success}</p>}

      <div className="mt-4 flex flex-col gap-2">
        {documents.map((document) => {
          const name = documentName(document);
          const createdAt = documentCreatedAt(document);
          const uploadedBy = document.uploaded_by_name ?? document.uploadedByName;
          return (
            <article
              key={document.id}
              className="flex flex-col gap-3 rounded-xl border border-line/70 bg-white p-3 sm:flex-row sm:items-center"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-soft text-petrol">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {createdAt ? formatLongDate(createdAt) : "Date non renseignée"}
                  {uploadedBy ? ` · ${uploadedBy}` : ""}
                </p>
              </div>
              <a
                href={`/api/core/lease-file/${encodeURIComponent(document.id)}`}
                download={name}
                className="btn-soft h-9 shrink-0 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </a>
            </article>
          );
        })}
        {documents.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-cream-soft/50 px-5 py-8 text-center">
            <FileText className="mx-auto h-5 w-5 text-muted" />
            <p className="mt-2 text-sm font-semibold text-ink">Aucun document partagé</p>
            <p className="mt-1 text-xs text-muted">
              {leaseId
                ? "Les documents déposés apparaîtront ici pour les deux parties."
                : "Le bail doit d'abord être créé par le propriétaire."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
