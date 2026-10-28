"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { STATUS_META, STATUS_FLOW } from "@/lib/meta";
import type { TicketStatus as TicketStatusType } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function TicketStatus({
  status,
  showDot = true,
  className,
}: {
  status: TicketStatusType;
  showDot?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("chip", meta.chip, className)}>
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />}
      {meta.label}
    </span>
  );
}

export function StatusSelect({
  status,
  onChange,
  className,
}: {
  status: TicketStatusType;
  onChange: (status: TicketStatusType) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = STATUS_META[status];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-[12px] font-semibold text-ink transition hover:bg-cream-soft"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
        <span className="text-muted">Statut :</span>
        <span>{meta.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-12 z-40 w-56 animate-scale-in rounded-xl border border-line bg-white p-1.5 shadow-float"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
            Changer le statut
          </p>
          {STATUS_FLOW.map((item) => {
            const itemMeta = STATUS_META[item];
            return (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={item === status}
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition",
                  item === status ? "bg-cream-soft text-ink" : "text-muted hover:bg-cream-soft hover:text-ink",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", itemMeta.dot)} />
                <span className="flex-1">{itemMeta.label}</span>
                {item === status && <Check className="h-3.5 w-3.5 text-sage" />}
              </button>
            );
          })}
          <p className="border-t border-line px-2.5 pb-1 pt-2 text-[9.5px] leading-relaxed text-muted">
            Chaque changement est horodaté et visible par les deux parties.
          </p>
        </div>
      )}
    </div>
  );
}
