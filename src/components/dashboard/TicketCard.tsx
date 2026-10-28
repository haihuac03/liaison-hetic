import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Handshake,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { CATEGORY_META, STATUS_META, TONE_CLASSES } from "@/lib/meta";
import type { Ticket } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProperty } from "@/lib/property";

export default function TicketCard({ ticket }: { ticket: Ticket }) {
  const { setActiveProperty } = useProperty();
  const status = STATUS_META[ticket.status];
  const tone = TONE_CLASSES[ticket.badgeTone];
  const category = CATEGORY_META[ticket.category];
  const CategoryIcon = category.icon;

  const footer = {
    icon: ticket.status === "ferme" || ticket.status === "resolu" ? CheckCircle2 : MessageSquare,
    text: ticket.status === "ferme" ? "Dossier fermé · historique consultable" : status.description,
  };

  const FooterIcon = footer.icon;

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      onClick={() => ticket.propertyId && setActiveProperty(ticket.propertyId)}
      className="group flex items-center gap-2.5 rounded-xl bg-cream-soft p-3 transition-all hover:bg-[#F1F0EA] hover:shadow-[inset_0_0_0_1px_rgba(36,59,71,0.06)]"
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white shadow-sm",
          ticket.status === "resolu" || ticket.status === "ferme"
            ? "text-sage"
            : "text-petrol",
        )}
      >
        <CategoryIcon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-petrol px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-white">
            #{ticket.id.slice(0, 8)}
          </span>
          <h3 className="truncate text-[11.5px] font-bold text-ink">{ticket.shortTitle}</h3>
          <span className={cn("chip ml-auto hidden shrink-0 sm:inline-flex", tone.chip)}>
            {ticket.badge}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-[10px] leading-relaxed text-muted">
          {ticket.description}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[9.5px] font-medium text-[#697274]">
          <FooterIcon className="h-3 w-3" />
          {footer.text}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-[#8C9394] transition group-hover:translate-x-0.5 group-hover:text-petrol" />
    </Link>
  );
}
