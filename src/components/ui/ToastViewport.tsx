import { Check, Loader2, AlertTriangle, Info, X } from "lucide-react";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";

const toneStyles = {
  success: {
    icon: Check,
    tile: "bg-sage text-white",
    border: "border-sage/20",
  },
  info: {
    icon: Info,
    tile: "bg-petrol text-white",
    border: "border-petrol/15",
  },
  warning: {
    icon: AlertTriangle,
    tile: "bg-peach text-peach-dark",
    border: "border-peach-dark/15",
  },
};

export default function ToastViewport() {
  const { toasts, dismissToast } = useUI();

  return (
    <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed bottom-5 right-5 z-[150] flex w-[calc(100%-2.5rem)] max-w-sm flex-col gap-2 sm:w-[360px]">
      {toasts.map((toast) => {
        const style = toneStyles[toast.tone ?? "success"];
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            role={toast.tone === "warning" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex animate-fade-up items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-float",
              style.border,
            )}
          >
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", style.tile)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[12.5px] font-bold leading-snug text-ink">{toast.title}</p>
              {toast.detail && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{toast.detail}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-md p-1 text-muted transition hover:bg-cream-soft hover:text-ink"
              aria-label="Fermer la notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
