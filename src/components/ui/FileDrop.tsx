"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FileDrop({
  onFiles,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  multiple = true,
  label = "Glissez-déposez vos photos ou documents",
  helper = "PNG, JPG, WebP, PDF · jusqu'à 10 Mo par fichier",
  compact = false,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  helper?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center transition",
        compact ? "px-3 py-4" : "px-4 py-6",
        dragging
          ? "border-sage bg-sage-soft"
          : "border-[#D9D7CF] bg-cream-soft/80 hover:border-sage/40 hover:bg-sage-soft/40",
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-petrol shadow-sm">
        <UploadCloud className="h-4 w-4" />
      </span>
      <p className="mt-2 text-[10px] font-semibold text-ink">{label}</p>
      {!compact && <p className="mt-0.5 text-[9px] text-muted">{helper}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
