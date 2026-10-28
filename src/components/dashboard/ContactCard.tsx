"use client";

import Link from "next/link";
import { Mail, MessageSquare, Phone, ShieldCheck, Star } from "lucide-react";
import type { Contact } from "@/lib/types";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";

const toneClasses = {
  petrol: "bg-petrol-soft text-petrol",
  sage: "bg-sage-soft text-sage",
  peach: "bg-peach-soft text-peach-dark",
  sky: "bg-sky-soft text-sky-dark",
};

export default function ContactCard({
  contact,
  compact = false,
  highlight = false,
}: {
  contact: Contact;
  compact?: boolean;
  highlight?: boolean;
}) {

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl px-1 py-2 transition hover:bg-cream-soft">
        <Avatar
          src={contact.avatar}
          initials={contact.initials}
          size="md"
          tone={contact.color}
          online={contact.online}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[11.5px] font-bold text-ink">{contact.name}</p>
            {contact.online && <span className="text-[8.5px] font-semibold text-sage">En ligne</span>}
            {contact.certified && !contact.online && (
              <ShieldCheck className="h-3 w-3 shrink-0 text-sage" />
            )}
          </div>
          <p className="truncate text-[9.5px] text-muted">{contact.role}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/conversations?contact=${contact.id}`}
            className="icon-btn h-7 w-7 rounded-lg"
            aria-label={`Écrire à ${contact.name}`}
          >
            <MessageSquare className="h-3 w-3" />
          </Link>
          {contact.phone ? (
            <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="icon-btn h-7 w-7 rounded-lg" aria-label={`Appeler ${contact.name}`}>
              <Phone className="h-3 w-3" />
            </a>
          ) : (
            <a
              href={`mailto:${contact.email ?? ""}`}
              className="icon-btn h-7 w-7 rounded-lg"
              aria-label={`Envoyer un email à ${contact.name}`}
            >
              <Mail className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "card flex h-full flex-col p-4 transition",
        highlight && "border-sage/45 ring-2 ring-sage/25",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={contact.avatar}
          initials={contact.initials}
          size="lg"
          tone={contact.color}
          online={contact.online}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate font-headline text-[13.5px] font-bold text-ink">{contact.name}</h3>
            {contact.tag && (
              <span className={cn("chip", toneClasses[contact.color])}>{contact.tag}</span>
            )}
          </div>
          <p className="mt-0.5 text-[10.5px] font-medium text-muted">{contact.role}</p>
          <div className="mt-1 flex items-center gap-2 text-[9.5px]">
            {contact.online && (
              <span className="flex items-center gap-1 font-semibold text-sage">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                En ligne
              </span>
            )}
            {contact.rating && (
              <span className="flex items-center gap-0.5 font-semibold text-[#A66A2B]">
                <Star className="h-3 w-3 fill-[#E3B573] text-[#E3B573]" />
                {contact.rating.toFixed(1).replace(".", ",")}
              </span>
            )}
            <span className="text-muted">Dernier contact {contact.lastContact}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted">{contact.subtitle}</p>

      <div className="mt-auto grid grid-cols-3 gap-1.5 pt-4">
        <Link
          href={`/conversations?contact=${contact.id}`}
          className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-cream-soft text-[9.5px] font-semibold text-ink transition hover:bg-cream-dark"
        >
          <MessageSquare className="h-3 w-3" />
          Écrire
        </Link>
        <a href={contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : `mailto:${contact.email ?? ""}`} className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-cream-soft text-[9.5px] font-semibold text-ink transition hover:bg-cream-dark">
          <Phone className="h-3 w-3" />
          Appeler
        </a>
        <a
          href={`mailto:${contact.email ?? ""}`}
          className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-cream-soft text-[9.5px] font-semibold text-ink transition hover:bg-cream-dark"
        >
          <Mail className="h-3 w-3" />
          Email
        </a>
      </div>
    </article>
  );
}
