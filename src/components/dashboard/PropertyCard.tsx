import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, FileText, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProperty } from "@/lib/property";

export default function PropertyCard() {
  const { user } = useAuth();
  const { activeProperty: property } = useProperty();
  return (
    <section className="card flex h-full flex-col overflow-hidden">
      <div className="relative h-[188px] w-full overflow-hidden">
        <Image
          src="/images/apartment.jpg"
          alt="Appartement lumineux avec cuisine ouverte et salon"
          width={900}
          height={600}
          className="h-full w-full object-cover transition duration-700 hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-petrol-dark/25 via-transparent to-transparent" />
        <span className="chip absolute left-3.5 top-3.5 bg-white/95 text-sage-dark shadow-sm backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-sage" />
          {property ? "Logement actif" : "À compléter"}
        </span>
        <span className="chip absolute bottom-3.5 right-3.5 bg-petrol/85 text-white backdrop-blur">
          {user?.role === "owner" ? "Propriétaire" : "Locataire"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="eyebrow">Mon logement</p>
        <h2 className="mt-1.5 font-headline text-[19px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Logement partagé
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{property?.address || "Ajoutez votre logement pour commencer."}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-cream-soft p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">Votre rôle</p>
            <p className="mt-1 text-[11.5px] font-bold leading-snug text-ink">{user?.role === "owner" ? "Propriétaire" : "Locataire"}</p>
          </div>
          <div className="rounded-xl bg-cream-soft p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{user?.role === "owner" ? "Locataire" : "Propriétaire"}</p>
            <p className="mt-1 text-[11.5px] font-bold leading-snug text-ink">{user?.role === "owner" ? property?.tenant_id ? "Rattaché" : "En attente" : property?.owner_name || "En attente"}</p>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-cream-soft p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white text-sage shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10.5px] font-bold leading-tight text-ink">Espace partagé LIAISON</p>
            <p className="mt-0.5 truncate text-[9px] text-muted">{property?.address || "Aucun logement rattaché"}</p>
          </div>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
        </div>

        <Link
          href="/logements"
          className="mt-auto flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cream-soft pt-0 text-[11.5px] font-semibold text-ink transition hover:bg-cream-dark"
        >
          <FileText className="h-4 w-4" />
          {user?.role === "owner" ? "Gérer mes logements" : "Voir mon logement"}
          <ArrowUpRight className="h-3.5 w-3.5 text-muted" />
        </Link>
      </div>
    </section>
  );
}
