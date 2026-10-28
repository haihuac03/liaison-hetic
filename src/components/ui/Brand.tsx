import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Brand({
  compact = false,
  light = false,
  className,
}: {
  compact?: boolean;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] shadow-sm",
          light ? "bg-white/10 text-white" : "bg-petrol text-white",
        )}
      >
        <Scale className="h-[20px] w-[20px]" strokeWidth={1.9} />
      </div>
      <div className="flex min-w-0 flex-col">
        <span
          className={cn(
            "font-headline text-[17px] font-extrabold leading-none tracking-[0.055em]",
            light ? "text-white" : "text-petrol",
          )}
        >
          LIAISON
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 truncate text-[9.5px] font-medium leading-none tracking-[0.015em]",
              light ? "text-white/60" : "text-muted",
            )}
          >
            Locataires &amp; propriétaires
          </span>
        )}
      </div>
    </div>
  );
}
