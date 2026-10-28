"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  ChevronDown,
  FileText,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  Ticket,
  Wallet,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    id: "creer-ticket",
    category: "Prise en main",
    question: "Comment créer un ticket ou signaler un problème ?",
    answer:
      "Cliquez sur le bouton de création dans la barre supérieure. Le ticket est rattaché au logement actif, puis partagé avec l’autre partie.",
    link: { label: "Créer un ticket", href: "/tickets" },
  },
  {
    id: "suivre-ticket",
    category: "Prise en main",
    question: "Comment suivre l'avancement de mon ticket ?",
    answer:
      "La frise du ticket affiche uniquement les événements enregistrés : création, messages, intervention, accord, clôture et réouverture. Les pièces restent consultables après fermeture.",
    link: { label: "Voir mes tickets", href: "/tickets" },
  },
  {
    id: "prelevement",
    category: "Loyer & paiement",
    question: "Comment suivre le loyer du logement ?",
    answer:
      "Le propriétaire crée les échéances à partir du bail. Il enregistre les paiements manuellement ; aucun prélèvement bancaire n’est exécuté par LIAISON.",
    link: { label: "Voir mon loyer", href: "/loyer" },
  },
  {
    id: "quittance",
    category: "Loyer & paiement",
    question: "Comment obtenir une quittance de loyer ?",
    answer:
      "Les quittances sont des documents déposés par les parties dans le logement. Elles apparaissent dans la section Justificatifs du loyer lorsqu’elles sont disponibles.",
    link: { label: "Télécharger une quittance", href: "/loyer" },
  },
  {
    id: "revision",
    category: "Négociation",
    question: "Mon bailleur peut-il augmenter le loyer cette année ?",
    answer:
      "Une révision annuelle dépend de la clause du bail et des règles applicables. Utilisez un ticket et ses messages pour échanger les éléments ; aucune négociation dédiée n’est simulée ici.",
    link: { label: "Ouvrir les tickets", href: "/tickets" },
  },
  {
    id: "accord",
    category: "Négociation",
    question: "Que se passe-t-il après un accord sur le loyer ?",
    answer:
      "Lorsque les deux parties acceptent un montant, le ticket passe en « accord trouvé ». Vous pouvez alors demander la clôture avec des conditions écrites. L’autre partie doit accepter la même version avant la fermeture du ticket.",
    link: { label: "Ouvrir le ticket", href: "/tickets" },
  },
  {
    id: "documents",
    category: "Documents",
    question: "Comment ajouter un document à mon coffre-fort ?",
    answer:
      "Depuis Documents, ajoutez un PDF ou une photo au logement actif. Les fichiers sont contrôlés côté serveur et les catégories sont déduites du nom du fichier.",
    link: { label: "Ouvrir mes documents", href: "/documents" },
  },
  {
    id: "eidas",
    category: "Documents",
    question: "Quels documents sont conservés dans LIAISON ?",
    answer:
      "LIAISON conserve les fichiers et les actions avec leur date. Ces éléments facilitent le suivi du ticket. Aucun certificat de signature qualifiée n’est délivré par l’application.",
    link: { label: "Voir mes documents enregistrés", href: "/documents" },
  },
  {
    id: "intervention",
    category: "Interventions",
    question: "Comment préparer l'arrivée d'un artisan ?",
    answer:
      "Acceptez ou refusez la proposition d’intervention. Après le compte rendu du propriétaire, confirmez ou contestez la réalisation. Aucune signature électronique n’est délivrée.",
    link: { label: "Voir l'intervention", href: "/tickets" },
  },
  {
    id: "assistant",
    category: "Assistant IA",
    question: "L'assistant LIAISON peut-il me donner un conseil juridique ?",
    answer:
      "Non. L'assistant délivre une information générale à partir de votre ticket et de textes publics. Il vous aide à préparer vos échanges et à comprendre vos droits, mais ne remplace ni un avocat, ni un notaire, ni un conciliateur. Pour une situation complexe, consultez un professionnel du droit.",
    link: { label: "Poser une question", href: "/assistant" },
  },
  {
    id: "donnees",
    category: "Sécurité",
    question: "Qui peut voir mes messages et mes documents ?",
    answer:
      "Les comptes, tickets et fichiers partagés sont stockés sur le serveur local. Les contrôles d’accès limitent la visibilité aux parties concernées.",
    link: { label: "Gérer mes paramètres", href: "/parametres" },
  },
  {
    id: "litige",
    category: "Sécurité",
    question: "Que faire si le désaccord persiste avec mon bailleur ?",
    answer:
      "Commencez par un échange écrit factuel et horodaté via LIAISON. Si aucune solution n'est trouvée, vous pouvez demander une médiation, saisir la commission départementale de conciliation ou, selon le montant, le tribunal compétent. Conservez toutes les pièces et les échanges.",
    link: { label: "Ouvrir une discussion", href: "/conversations" },
  },
];

const CATEGORIES = [
  "Toutes",
  "Prise en main",
  "Loyer & paiement",
  "Négociation",
  "Documents",
  "Interventions",
  "Assistant IA",
  "Sécurité",
];

const GUIDES = [
  {
    id: "guide-ticket",
    title: "Créer un ticket efficace",
    detail: "Décrivez, photographiez, envoyez en 2 minutes.",
    href: "/tickets",
    icon: Ticket,
    tone: "bg-sky-soft text-sky-dark",
  },
  {
    id: "guide-doc",
    title: "Organiser ses documents",
    detail: "Bail, quittances, devis et accords au même endroit.",
    href: "/documents",
    icon: FileText,
    tone: "bg-peach-soft text-peach-dark",
  },
  {
    id: "guide-ia",
    title: "Utiliser l'assistant",
    detail: "Comprendre une clause ou préparer un message.",
    href: "/assistant",
    icon: Bot,
    tone: "bg-petrol text-white",
  },
  {
    id: "guide-loyer",
    title: "Comprendre son loyer",
    detail: "Décomposition, quittances et révision annuelle.",
    href: "/loyer",
    icon: Wallet,
    tone: "bg-sage-soft text-sage",
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function AidePage() {
  const { openNewTicket, showToast } = useUI();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toutes");
  const [open, setOpen] = useState<string | null>("creer-ticket");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return FAQS.filter((faq) => {
      const matchesCategory = category === "Toutes" || faq.category === category;
      const matchesQuery =
        !q || normalize(`${faq.question} ${faq.answer} ${faq.category}`).includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Centre d&apos;aide
              <span className="text-muted/50">·</span>
              <span className="font-medium normal-case tracking-normal text-muted">
                Questions et guides
              </span>
            </p>
            <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
              Besoin d&apos;un coup de main ?
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Trouvez une réponse rapide, découvrez les guides LIAISON ou contactez notre équipe de
              médiation.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href="/conversations" className="btn-soft h-10">
              <Mail className="h-4 w-4 text-sage" />
              Ouvrir les conversations
            </Link>
            <button
              type="button"
              onClick={() => openNewTicket("autre")}
              className="btn-dark h-10"
            >
              <Plus className="h-4 w-4" />
              Signaler un problème
            </button>
          </div>
        </header>

        <section className="relative mt-5 overflow-hidden rounded-card bg-petrol p-5 text-white shadow-[0_22px_45px_-30px_rgba(36,59,71,0.65)] sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/[0.035]" />
          <div className="pointer-events-none absolute -bottom-28 right-24 h-56 w-56 rounded-full border border-white/[0.05]" />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
                Recherche dans l&apos;aide
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold text-mint">
                <ShieldCheck className="h-3 w-3" />
                {FAQS.length} réponses vérifiées
              </span>
            </div>
            <h2 className="mt-2 font-headline text-[20px] font-bold tracking-[-0.02em] sm:text-[23px]">
              Comment pouvons-nous vous aider ?
            </h2>
            <div className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-white px-3.5">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher : loyer, quittance, artisan, accord, préavis…"
                className="min-w-0 flex-1 bg-transparent text-[11px] text-ink outline-none placeholder:text-muted/70"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-[9px] font-semibold text-muted hover:text-ink"
                >
                  Effacer
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {["Quittance", "Révision du loyer", "Intervention", "Document enregistré"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setQuery(suggestion)}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[8.5px] font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
          </div>
        </section>

        <div className="no-scrollbar mt-4 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {CATEGORIES.map((item) => {
            const count =
              item === "Toutes" ? FAQS.length : FAQS.filter((faq) => faq.category === item).length;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[9.5px] font-semibold transition",
                  category === item
                    ? "bg-petrol text-white shadow-[0_6px_14px_-10px_rgba(36,59,71,0.7)]"
                    : "border border-line bg-white/70 text-muted hover:border-petrol/20 hover:text-ink",
                )}
              >
                {item}
                <span className={cn("text-[8px]", category === item ? "text-white/55" : "text-muted/60")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Questions fréquentes</p>
                <h2 className="mt-1 font-headline text-[17px] font-bold tracking-[-0.02em] text-ink">
                  {filtered.length} réponse{filtered.length > 1 ? "s" : ""} à votre recherche
                </h2>
              </div>
              <span className="chip bg-cream-soft text-[#5F686B]">
                <HelpCircle className="h-2.5 w-2.5" />
                Mis à jour le 20 oct. 2026
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-12 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-soft text-muted">
                  <Search className="h-4 w-4" />
                </span>
                <p className="mt-2 text-[11.5px] font-bold text-ink">Aucune réponse trouvée</p>
                <p className="mt-0.5 max-w-xs text-[9.5px] leading-relaxed text-muted">
                  Essayez un autre mot-clé ou contactez directement l&apos;équipe LIAISON.
                </p>
                <button
                  type="button"
                  onClick={() => openNewTicket("autre")}
                  className="btn-dark mt-3 h-8 px-3.5 text-[9.5px]"
                >
                  <MessageSquare className="h-3 w-3" />
                  Poser ma question
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {filtered.map((faq) => {
                  const isOpen = open === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className={cn(
                        "overflow-hidden rounded-xl border transition",
                        isOpen ? "border-sage/25 bg-sage-soft/25" : "border-line/80 bg-white",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : faq.id)}
                        className="flex w-full items-center gap-2.5 px-3 py-3 text-left"
                        aria-expanded={isOpen}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]",
                            isOpen ? "bg-sage text-white" : "bg-cream-soft text-petrol",
                          )}
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10.5px] font-bold leading-snug text-ink">
                            {faq.question}
                          </span>
                          <span className="mt-0.5 block text-[8px] font-medium text-muted">
                            {faq.category}
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted transition",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="animate-fade-in px-3 pb-3 pl-[50px]">
                          <p className="text-[9.5px] leading-relaxed text-[#4A5559]">{faq.answer}</p>
                          <Link
                            href={faq.link.href}
                            className="mt-2 flex w-fit items-center gap-1 text-[8.5px] font-semibold text-sage transition hover:underline"
                          >
                            {faq.link.label}
                            <ArrowRight className="h-2.5 w-2.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-line/70 bg-cream-soft px-3 py-2.5">
              <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <p className="text-[8px] leading-relaxed text-muted">
                Information générale — ne remplace pas un professionnel du droit. Les réponses
                présentées ici ne constituent pas un conseil juridique personnalisé.
              </p>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <section className="card p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-cream-soft text-petrol">
                  <LifeBuoy className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h2 className="text-[11px] font-bold text-ink">Parler à quelqu&apos;un</h2>
                  <p className="text-[8px] text-muted">Interlocuteurs du logement</p>
                </div>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-muted">
                Pour une situation précise, échangez dans le ticket partagé avec l’autre partie et conservez les pièces utiles.
              </p>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <Link
                  href="/conversations"
                  className="flex h-8 items-center gap-2 rounded-lg bg-cream-soft px-2.5 text-[8.5px] font-semibold text-ink transition hover:bg-cream-dark"
                >
                  <Mail className="h-3 w-3 text-sage" />
                  Voir les échanges
                  <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                </Link>
                <Link
                  href="/tickets"
                  className="flex h-8 items-center gap-2 rounded-lg bg-cream-soft px-2.5 text-[8.5px] font-semibold text-ink transition hover:bg-cream-dark"
                >
                  <Phone className="h-3 w-3 text-sage" />
                  Créer un ticket
                  <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                </Link>
                <button
                  type="button"
                  onClick={() => openNewTicket("autre")}
                  className="flex h-8 items-center gap-2 rounded-lg bg-petrol px-2.5 text-[8.5px] font-bold text-white transition hover:bg-petrol-dark"
                >
                  <Plus className="h-3 w-3" />
                  Ouvrir une demande
                  <ArrowUpRight className="ml-auto h-3 w-3 text-white/60" />
                </button>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[7.5px] text-muted">
                <ShieldCheck className="h-2.5 w-2.5 text-sage" />
                Échanges conservés dans le ticket
              </p>
            </section>

            <section className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[11px] font-bold text-ink">Guides essentiels</h2>
                <span className="text-[8px] text-muted">4 parcours</span>
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                {GUIDES.map((guide) => (
                  <Link
                    key={guide.id}
                    href={guide.href}
                    className="group flex items-center gap-2.5 rounded-xl border border-line/80 p-2.5 transition hover:bg-cream-soft"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]",
                        guide.tone,
                      )}
                    >
                      <guide.icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9.5px] font-bold text-ink">
                        {guide.title}
                      </span>
                      <span className="block truncate text-[8px] text-muted">{guide.detail}</span>
                    </span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-muted/60 transition group-hover:text-sage" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-card border border-petrol/10 bg-petrol p-4 text-white shadow-soft">
              <div className="flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5 text-mint" />
                <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/60">
                  Vos droits
                </p>
              </div>
              <p className="mt-1.5 text-[9.5px] font-semibold leading-relaxed">
                Un litige non résolu ? La commission départementale de conciliation peut être saisie
                gratuitement.
              </p>
              <button
                type="button"
                onClick={() =>
                  showToast(
                    "Médiation & conciliation",
                    "LIAISON peut vous aider à préparer un ticket de saisine. Consultez un professionnel du droit pour votre situation.",
                    "info",
                  )
                }
                className="mt-2 flex items-center gap-1 text-[8.5px] font-bold text-mint transition hover:text-white"
              >
                En savoir plus
                <ArrowRight className="h-2.5 w-2.5" />
              </button>
            </section>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-white/45 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] font-medium text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            Centre d&apos;aide LIAISON · documentation fonctionnelle
          </p>
          <Link
            href="/assistant"
            className="flex items-center gap-1 text-[9px] font-semibold text-muted transition hover:text-sage"
          >
            Une question plus précise ?
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
