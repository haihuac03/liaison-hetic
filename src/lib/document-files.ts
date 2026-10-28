export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, (typeof DOCUMENT_MIME_TYPES)[number]> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function documentMimeFor(
  name: string,
  declaredType?: string | null,
): (typeof DOCUMENT_MIME_TYPES)[number] | null {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const detected = MIME_BY_EXTENSION[extension];
  if (!detected) return null;

  const declared = (declaredType || "").trim().toLowerCase();
  if (!declared || declared === "application/octet-stream") return detected;
  return declared === detected ? detected : null;
}
