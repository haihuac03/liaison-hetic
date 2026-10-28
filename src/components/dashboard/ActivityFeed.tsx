import Link from "next/link";
import {
  FileText,
  Handshake,
  MessageSquare,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useProperty } from "@/lib/property";
import { cn } from "@/lib/utils";

const iconMap = {
  intervention: Wrench,
  message: MessageSquare,
  document: FileText,
  contract: Handshake,
};

const toneMap = {
  intervention: "bg-sage-light text-sage-dark",
  message: "bg-sky text-sky-dark",
  document: "bg-cream-dark text-[#626B6D]",
  contract: "bg-peach-soft text-peach-dark",
};

export default function ActivityFeed() {
  const { scopedTickets, setActiveProperty } = useProperty();
  const activities = scopedTickets.slice(0, 3).map((ticket) => ({
    id: ticket.id,
    type: "message" as const,
    title: ticket.title,
    time: ticket.updatedAt,
    text: ticket.description,
    href: `/tickets/${ticket.id}`,
    propertyId: ticket.propertyId,
  }));
  return (
    <section className="card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-cream-soft text-petrol">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h2 className="font-headline text-[16px] font-bold tracking-[-0.015em] text-ink">
            Dernières activités
          </h2>
        </div>
        <span className="chip hidden shrink-0 bg-cream-dark text-[#5F686B] sm:inline-flex">
          Historique partagé
        </span>
      </div>

      <div className="mt-4 flex flex-col">
        {activities.map((activity, index) => {
          const Icon = iconMap[activity.type];
          const last = index === activities.length - 1;
          return (
            <Link
              key={activity.id}
              href={activity.href}
              onClick={() => activity.propertyId && setActiveProperty(activity.propertyId)}
              className="group relative flex gap-3 pb-4 last:pb-0"
            >
              {!last && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-line" />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                  toneMap[activity.type],
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-[11.5px] font-bold leading-snug text-ink group-hover:text-petrol">
                    {activity.title}
                  </p>
                  <span className="text-[9px] font-medium text-muted">{activity.time}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted">
                  {activity.text}
                </p>
              </div>
            </Link>
          );
        })}
        {activities.length === 0 && (
          <p className="rounded-xl bg-cream-soft px-3 py-5 text-center text-[10px] text-muted">
            Les nouvelles activités de vos tickets apparaîtront ici.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line/70 bg-cream-soft px-3 py-2.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sage" />
        <p className="text-[9.5px] leading-relaxed text-muted">
          Les échanges sont enregistrés dans vos dossiers.{" "}
          <Link href="/aide" className="font-semibold text-sage hover:underline">
            En savoir plus
          </Link>
        </p>
      </div>
    </section>
  );
}
