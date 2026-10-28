"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bot,
  FileSearch,
  FileText,
  Handshake,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Avatar from "@/components/ui/Avatar";
import TicketStatus from "@/components/ui/TicketStatus";
import { ASSISTANT_SUGGESTIONS, answerQuestion } from "@/lib/assistant";
import { useAuth } from "@/lib/auth";
import { useProperty } from "@/lib/property";
import { useUI } from "@/lib/ui";
import { todayLong } from "@/lib/utils";

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  tag?: string;
  source?: string;
  actions?: string[];
}

const WELCOME: AssistantMessage = {
  id: "welcome",
  role: "assistant",
  time: "À l'instant",
  tag: "ASSISTANT LIAISON",
  text: "Bonjour. Je peux vous aider à comprendre une clause de votre bail, préparer un message à l’autre partie ou identifier les pièces utiles de votre dossier.",
  source: "Informations du logement actif",
  actions: [
    "Résumer ma situation",
    "Préparer un message au bailleur",
    "Vérifier la révision du loyer",
  ],
};

const SOURCES = [
  {
    id: "loi-89",
    label: "Loi n° 89-462",
    detail: "Rapports locatifs · art. 17, 22 & 23",
    tag: "Loi",
  },
  {
    id: "decret-87",
    label: "Décret n° 87-712",
    detail: "Réparations locatives · art. 2",
    tag: "Décret",
  },
  {
    id: "alur",
    label: "Loi ALUR",
    detail: "Zone tendue · préavis & état des lieux",
    tag: "Loi",
  },
  {
    id: "assurances",
    label: "Code des assurances",
    detail: "Déclaration de sinistre · art. L113-2",
    tag: "Code",
  },
];

function nowTime() {
  return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function AssistantPage() {
  const { user } = useAuth();
  const { scopedTickets: tickets, activeProperty } = useProperty();
  const { openNewTicket, showToast } = useUI();
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);

  const linkedTicket = tickets[0];
  const negotiationTicket = tickets[1];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, thinking]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const send = (question: string) => {
    const clean = question.trim();
    if (!clean || thinking) return;
    const response = answerQuestion(clean);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: clean,
        time: nowTime(),
      },
    ]);
    setInput("");
    setThinking(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response.text,
          time: nowTime(),
          tag: response.tag,
          source: response.source,
          actions: response.actions,
        },
      ]);
      setThinking(false);
    }, 850);
  };

  const runAction = (action: string) => {
    if (/message|rédiger|rediger|préparer/i.test(action)) {
      const recipient = user?.role === "owner" ? activeProperty?.tenant_name : activeProperty?.owner_name;
      setInput(
        `Bonjour ${recipient || "votre interlocuteur"}, je souhaite revenir sur le dossier « ${linkedTicket?.title || "notre logement"} ». Voici les éléments factuels dont je dispose :`,
      );
      showToast("Brouillon préparé", "Vous pouvez compléter le message avant de l'envoyer.", "info");
      return;
    }
    if (/scanner|pièce|piece|joindre|document/i.test(action)) {
      showToast("Documents", "Ajoutez et consultez les pièces depuis la page Documents du logement actif.", "info");
      return;
    }
    if (/dossier|situation|résumer|resumer/i.test(action)) {
      send("Résume ma situation et les prochaines étapes de mes dossiers.");
      return;
    }
    if (/clôturer|cloturer|accord/i.test(action)) {
      showToast(
        "Clôture avec accord",
        "Finalisez d'abord la négociation puis signez l'accord depuis le dossier concerné.",
        "info",
      );
      return;
    }
    showToast("Action disponible", `${action} — retrouvez les détails dans le dossier lié.`, "info");
  };

  const resetConversation = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setThinking(false);
    setMessages([{ ...WELCOME, time: nowTime() }]);
    setInput("");
    showToast("Conversation effacée", "Vous pouvez poser une nouvelle question à l'assistant.");
  };

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Assistant LIAISON
              <span className="text-muted/50">·</span>
              <span className="font-medium normal-case tracking-normal text-muted">
                Analyse de votre dossier
              </span>
            </p>
            <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
              Votre conseiller numérique
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Posez une question sur votre bail, un loyer, une réparation ou une procédure :
              l&apos;assistant vous aide à préparer vos échanges avec le bailleur.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" onClick={resetConversation} className="btn-soft h-10">
              <Trash2 className="h-4 w-4 text-muted" />
              Nouvelle conversation
            </button>
            <Link href="/documents" className="btn-dark h-10"><FileText className="h-4 w-4" />Voir mes documents</Link>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-sage/15 bg-sage-soft/60 px-4 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sage shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
          <p className="min-w-0 flex-1 text-[9.5px] leading-relaxed text-muted">
            Cet outil propose des réponses générales prédéfinies. Il ne lit pas les pièces et ne remplace pas un professionnel du droit.
          </p>
          <span className="chip bg-white text-sage-dark">Aide statique</span>
          <span className="chip bg-white text-[#5F686B]">{todayLong()}</span>
        </div>

        <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="card flex h-[720px] flex-col overflow-hidden">
            <header className="flex shrink-0 items-center gap-2.5 border-b border-line/80 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-petrol text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="font-headline text-[13px] font-bold text-ink">Assistant LIAISON</h2>
                  <span className="chip bg-sage-light text-sage-dark">
                    <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                    Disponible
                  </span>
                </div>
                <p className="mt-0.5 text-[8.5px] text-muted">
                  Réponses générales prédéfinies
                </p>
              </div>
              <span className="hidden items-center gap-1 rounded-lg bg-cream-soft px-2 py-1 text-[8px] font-semibold text-muted sm:flex">
                <Sparkles className="h-2.5 w-2.5 text-sage" />
                IA d&apos;information
              </span>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto bg-[#FAF9F5] px-3.5 py-4"
              aria-live="polite"
            >
              <div className="flex justify-center">
                <span className="rounded-full border border-line/70 bg-white/90 px-3 py-1 text-[8px] font-medium text-muted shadow-sm">
                  {todayLong()}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-3.5">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end gap-2">
                      <div className="max-w-[86%]">
                        <div className="rounded-2xl rounded-tr-md bg-petrol px-3.5 py-2.5 text-[10.5px] leading-relaxed text-white shadow-soft">
                          {message.text}
                        </div>
                        <p className="mt-1 text-right text-[7.5px] text-muted">{message.time}</p>
                      </div>
                      <Avatar
                        src="/images/avatar-thomas.jpg"
                        initials="TM"
                        size="sm"
                        className="mt-0.5"
                      />
                    </div>
                  ) : (
                    <div key={message.id} className="flex gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-petrol text-white">
                        <Bot className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 max-w-[92%] flex-1">
                        <div className="rounded-2xl rounded-tl-md border border-sage/15 bg-white p-3 shadow-soft">
                          {message.tag && (
                            <span className="chip bg-sage-light text-[8px] text-sage-dark">
                              {message.tag}
                            </span>
                          )}
                          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink/85">
                            {message.text}
                          </p>
                          {message.source && (
                            <p className="mt-2 flex items-start gap-1 border-t border-line/70 pt-1.5 text-[8px] leading-relaxed text-muted">
                              <BookOpen className="mt-0.5 h-2.5 w-2.5 shrink-0 text-sage" />
                              {message.source}
                            </p>
                          )}
                          {message.actions && message.actions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {message.actions.map((action) => (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => runAction(action)}
                                  className="flex items-center gap-1 rounded-full border border-line bg-cream-soft px-2.5 py-1 text-[8px] font-semibold text-ink transition hover:border-sage/30 hover:bg-sage-soft hover:text-sage-dark"
                                >
                                  <ArrowRight className="h-2.5 w-2.5" />
                                  {action}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="mt-1 text-[7.5px] leading-relaxed text-muted/80">
                          {message.time} · Information générale — ne remplace pas un professionnel du
                          droit.
                        </p>
                      </div>
                    </div>
                  ),
                )}

                {thinking && (
                  <div className="flex gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-petrol text-white">
                      <Bot className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-line bg-white px-3 py-2.5 shadow-soft">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sage" />
                      <p className="text-[9.5px] font-medium text-muted">
                        Recherche d’une réponse générale…
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-line/80 bg-white px-3.5 pb-3 pt-2.5">
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-2">
                {ASSISTANT_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    disabled={thinking}
                    className="shrink-0 rounded-full border border-line bg-cream-soft px-2.5 py-1.5 text-[8.5px] font-semibold text-muted transition hover:border-sage/30 hover:bg-sage-soft hover:text-sage-dark disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 rounded-xl border border-line bg-paper p-1.5 focus-within:border-petrol/30 focus-within:bg-white focus-within:ring-4 focus-within:ring-petrol/5">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send(input);
                    }
                  }}
                  rows={2}
                  placeholder="Posez votre question sur le bail, le loyer, les travaux…"
                  className="min-h-[46px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[10.5px] leading-relaxed text-ink outline-none placeholder:text-muted/70"
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || thinking}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-petrol text-white transition hover:bg-petrol-dark disabled:opacity-40"
                  aria-label="Envoyer la question"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-1.5 flex items-center justify-center gap-1 text-center text-[7.5px] leading-relaxed text-muted/80">
                <ShieldCheck className="h-2.5 w-2.5 shrink-0 text-sage" />
                Information générale — ne remplace pas un professionnel du droit.
              </p>
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <section className="card p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-cream-soft text-petrol">
                  <FileSearch className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h2 className="text-[11px] font-bold text-ink">Contexte utilisé</h2>
                  <p className="text-[8px] text-muted">Pièces accessibles à l&apos;assistant</p>
                </div>
              </div>

              <div className="mt-2.5 flex flex-col gap-1.5">
                {linkedTicket && (
                  <Link
                    href={`/tickets/${linkedTicket.id}`}
                    className="rounded-xl border border-line/80 bg-cream-soft/60 p-2.5 transition hover:bg-cream-soft"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-petrol px-1.5 py-0.5 text-[7.5px] font-bold text-white">
                        #{linkedTicket.id.slice(0, 8)}
                      </span>
                      <TicketStatus status={linkedTicket.status} />
                      <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                    </div>
                    <p className="mt-1.5 text-[9.5px] font-bold leading-snug text-ink">
                      {linkedTicket.shortTitle}
                    </p>
                    <p className="mt-0.5 text-[8px] text-muted">
                      {linkedTicket.documents.length} pièces · {linkedTicket.assignee}
                    </p>
                  </Link>
                )}
                {negotiationTicket && (
                  <Link
                    href={`/tickets/${negotiationTicket.id}`}
                    className="rounded-xl border border-line/80 bg-cream-soft/60 p-2.5 transition hover:bg-cream-soft"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-petrol px-1.5 py-0.5 text-[7.5px] font-bold text-white">
                        #{negotiationTicket.id.slice(0, 8)}
                      </span>
                      <TicketStatus status={negotiationTicket.status} />
                      <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                    </div>
                    <p className="mt-1.5 text-[9.5px] font-bold leading-snug text-ink">
                      {negotiationTicket.shortTitle}
                    </p>
                    <p className="mt-0.5 text-[8px] text-muted">
                      {negotiationTicket.assignee} · {negotiationTicket.badge}
                    </p>
                  </Link>
                )}

              </div>
            </section>

            <section className="card p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-sage-soft text-sage">
                  <BookOpen className="h-3.5 w-3.5" />
                </span>
                <div>
                  <h2 className="text-[11px] font-bold text-ink">Sources juridiques</h2>
                  <p className="text-[8px] text-muted">Textes de référence mobilisés</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-col divide-y divide-line/60">
                {SOURCES.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() =>
                      showToast(
                        source.label,
                        `${source.detail} — texte public de référence.`,
                        "info",
                      )
                    }
                    className="flex items-center gap-2 py-2 text-left transition hover:text-sage"
                  >
                    <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded bg-cream-soft text-[7px] font-extrabold uppercase text-petrol">
                      {source.tag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9px] font-bold text-ink">
                        {source.label}
                      </span>
                      <span className="block truncate text-[7.5px] text-muted">{source.detail}</span>
                    </span>
                    <ArrowUpRight className="h-3 w-3 shrink-0 text-muted" />
                  </button>
                ))}
              </div>
              <p className="mt-2 rounded-lg bg-cream-soft px-2.5 py-2 text-[7.5px] leading-relaxed text-muted">
                Les réponses sont générées à partir de ces sources et de votre dossier. Vérifiez
                toujours la version en vigueur du texte.
              </p>
            </section>

            <section className="card p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-peach-soft text-peach-dark">
                  <Lightbulb className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-[11px] font-bold text-ink">Actions rapides</h2>
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => openNewTicket("autre")}
                  className="flex h-8 items-center gap-2 rounded-lg bg-cream-soft px-2.5 text-left text-[8.5px] font-semibold text-ink transition hover:bg-cream-dark"
                >
                  <MessageSquarePlus className="h-3 w-3 text-sage" />
                  Ouvrir un dossier
                  <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput("Peux-tu résumer les points d'accord et de désaccord de mon dossier ?");
                    showToast("Question préremplie", "Appuyez sur Envoyer pour l'analyser.", "info");
                  }}
                  className="flex h-8 items-center gap-2 rounded-lg bg-cream-soft px-2.5 text-left text-[8.5px] font-semibold text-ink transition hover:bg-cream-dark"
                >
                  <Handshake className="h-3 w-3 text-sage" />
                  Préparer une synthèse
                  <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                </button>
                <Link href="/documents" className="flex h-8 items-center gap-2 rounded-lg bg-cream-soft px-2.5 text-left text-[8.5px] font-semibold text-ink transition hover:bg-cream-dark">
                  <FileText className="h-3 w-3 text-sage" />Voir les documents<ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                </Link>
                <Link
                  href="/aide"
                  className="flex h-8 items-center gap-2 rounded-lg bg-cream-soft px-2.5 text-[8.5px] font-semibold text-ink transition hover:bg-cream-dark"
                >
                  <Wrench className="h-3 w-3 text-sage" />
                  Consulter le centre d&apos;aide
                  <ArrowUpRight className="ml-auto h-3 w-3 text-muted" />
                </Link>
              </div>
            </section>

            <section className="rounded-card border border-petrol/10 bg-petrol p-3.5 text-white shadow-soft">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-mint" />
                <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/60">
                  Périmètre &amp; limites
                </p>
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-white/70">
                L&apos;assistant fournit une information générale et facilite la médiation amiable.
                Il ne rédige pas d&apos;acte juridique et ne se substitue pas à un avocat, un notaire
                ou un conciliateur.
              </p>
              <p className="mt-2 text-[8px] font-semibold text-mint">
                Information générale — ne remplace pas un professionnel du droit.
              </p>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
