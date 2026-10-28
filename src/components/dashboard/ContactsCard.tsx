import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProperty } from "@/lib/property";

export default function ContactsCard() {
  const { user } = useAuth();
  const { activeProperty: property } = useProperty();
  const people = [
    property?.owner_name ? { id: "owner", name: property.owner_name, role: "Propriétaire" } : null,
    property?.tenant_name ? { id: "tenant", name: property.tenant_name, role: "Locataire" } : null,
  ].filter((person): person is { id: string; name: string; role: string } => Boolean(person && person.name !== user?.name));
  return (
    <section className="card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-cream-soft text-petrol">
            <Users className="h-4 w-4" />
          </div>
          <h2 className="font-headline text-[16px] font-bold tracking-[-0.015em] text-ink">
            Interlocuteurs directs
          </h2>
        </div>
        <span className="max-w-[150px] truncate text-[9px] font-semibold text-muted">{property?.address || "Logement à rattacher"}</span>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-line/60">
        {people.map((person) => (
          <Link key={person.id} href="/conversations" className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage-light text-[9px] font-bold text-sage-dark">
              {person.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-bold text-ink">{person.name}</span><span className="text-[8px] text-muted">{person.role}</span></span>
          </Link>
        ))}
        {people.length === 0 && <p className="py-4 text-[10px] leading-relaxed text-muted">{user?.role === "owner" ? "Le locataire apparaîtra ici après avoir rejoint le logement." : "Votre interlocuteur apparaîtra ici après confirmation du rattachement."}</p>}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-cream-soft px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sage-light text-sage">
            <Users className="h-3 w-3" />
          </span>
          <span className="text-[9.5px] text-muted">
            Votre cercle de confiance · <span className="font-semibold text-ink">{people[0]?.name || "En attente"}</span>
          </span>
        </div>
        <Link
          href="/contacts"
          className="flex items-center gap-1 text-[9.5px] font-semibold text-sage transition hover:underline"
        >
          Tous
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
