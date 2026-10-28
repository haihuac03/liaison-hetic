import { Building2, House } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RoleBadge({
  role,
  className,
}: {
  role: "owner" | "tenant";
  className?: string;
}) {
  const owner = role === "owner";
  const Icon = owner ? Building2 : House;
  const label = owner ? "Propriétaire" : "Locataire";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold leading-none text-white shadow-sm",
        owner ? "bg-petrol" : "bg-sage",
        className,
      )}
      aria-label={`Vous êtes ${label.toLowerCase()}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" strokeWidth={2} />
      <span>{label}</span>
    </span>
  );
}
