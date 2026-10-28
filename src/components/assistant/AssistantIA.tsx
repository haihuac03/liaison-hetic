"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FileSignature,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  ASSISTANT_DISCLAIMER,
  answerQuestion,
  getNegotiationAssistant,
  getTicketAssistant,
  type AssistantAnswer,
} from "@/lib/assistant";
import { useUI } from "@/lib/ui";
import type { Ticket } from "@/lib/types";
import { downloadText } from "@/lib/utils";

function actionIcon(label: string) {
  if (/message|rédiger|rédige|réponse/i.test(label)) return MessageSquareText;
  if (/décret|consulter|lire|vérifier/i.test(label)) return BookOpen;
  if (/attestation|accord|synthèse/i.test(label)) return FileSignature;
  return Sparkles;
}

export default function AssistantIA({
  ticket,
  onInsertMessage,
}: {
  ticket: Ticket;
  onInsertMessage?: (text: string) => void;
}) {
  const { showToast } = useUI();
  const baseAnswer =
    ticket.negotiation && ticket.negotiation.status === "open"
      ? getNegotiationAssistant(ticket.negotiation)
      : getTicketAssistant(ticket);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [question, setQuestion] = useState("");
  const shown = answer ?? baseAnswer;

  if (ticket.propertyId) return (
    <section className="card p-4">
      <h2 className="font-headline text-[13px] font-bold text-ink">Repères pour le ticket</h2>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">Décrivez les faits et ajoutez les documents utiles. Le propriétaire peut proposer une intervention. La clôture demande l’accord des deux participants.</p>
      <button type="button" onClick={() => onInsertMessage?.(`Bonjour ${ticket.assignee}, je reviens vers vous au sujet du ticket « ${ticket.title} ». `)} className="btn-soft mt-3 h-8 text-[9px]">Préparer un message</button>
    </section>
  );


  const buildDraft = () => {
    if (ticket.negotiation) {
      return `Bonjour Claire, merci pour votre proposition de révision à ${ticket.negotiation.ownerProposal} €. Je vous confirme que je reste disponible pour trouver un accord équilibré, en tenant compte de l'état du double vitrage. Je vous propose de formaliser notre accord par écrit dans le ticket LIAISON.`;
    }
    return "Bonjour Claire, je vous confirme ma présence jeudi 29 octobre entre 14h et 16h pour l'intervention de Plomberie Martin. Le meuble sous l'évier sera dégagé. Merci pour la prise en charge du devis.";
  };

  const runAction = (label: string) => {
    if (/décret/i.test(label)) {
      window.open("https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000693402", "_blank", "noopener");
      showToast("Décret 87-712 ouvert", "Source officielle Légifrance.", "info");
      return;
    }
    if (/message|rédiger|réponse/i.test(label)) {
      onInsertMessage?.(buildDraft());
      showToast("Message préparé", "Il a été inséré dans la conversation. Vous pouvez le modifier avant envoi.");
      return;
    }
    if (/attestation/i.test(label)) {
      downloadText(
        `Attestation_LIAISON_${ticket.id}.txt`,
        `ATTESTATION LIAISON\n\nDossier #${ticket.id} — ${ticket.title}\nDate : ${new Date().toLocaleDateString("fr-FR")}\nParties : Thomas Martin (locataire) et Claire Bernard (bailleur)\n\nLes échanges, photographies et documents du ticket sont horodatés et archivés conformément au protocole de conciliation LIAISON. L'intervention et les pièces associées peuvent être communiquées à l'assureur habitation.\n\nInformation générale — ne remplace pas un professionnel du droit.`,
      );
      showToast("Attestation générée", "Le document a été téléchargé.", "info");
      return;
    }
    if (/calcul|impact/i.test(label) && ticket.negotiation) {
      const diff = ticket.negotiation.ownerProposal - ticket.negotiation.currentRent;
      setAnswer({
        tag: "IMPACT ANNUELLE",
        text: `La révision représenterait ${diff} € supplémentaires par mois, soit ${diff * 12} € par an. Votre contre-proposition à ${ticket.negotiation.tenantCounter ?? 1065} € limiterait l'impact à ${((ticket.negotiation.tenantCounter ?? 1065) - ticket.negotiation.currentRent) * 12} € par an.`,
        actions: ["Préparer un message de réponse", "Générer la synthèse de l'accord"],
        source: "Calcul automatique LIAISON",
      });
      return;
    }
    setAnswer(answerQuestion(label, { ticket }));
    showToast("Analyse mise à jour", "L'assistant a précisé sa réponse.", "info");
  };

  const ask = () => {
    if (!question.trim()) return;
    setAnswer(answerQuestion(question, { ticket }));
    setQuestion("");
  };

  return (
    <section className="card p-4">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-sage-light text-sage-dark">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-headline text-[13px] font-bold leading-tight text-ink">
            Assistant LIAISON
          </h2>
          <p className="mt-0.5 text-[8px] leading-relaxed text-muted">
            Médiation &amp; Analyse
            <br />
            Droit locatif
          </p>
        </div>
      </div>

      <div key={shown.tag} className="mt-3 animate-fade-in rounded-xl bg-cream-soft p-3">
        <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.08em] text-sage">
          <BookOpen className="h-2.5 w-2.5" />
          {shown.tag}
        </p>
        <p className="mt-1.5 text-[9.5px] leading-relaxed text-[#3F4A4E]">{shown.text}</p>
        {shown.source && (
          <p className="mt-2 border-t border-line/70 pt-1.5 text-[7.5px] font-medium text-muted">
            {shown.source}
          </p>
        )}
      </div>

      <div className="mt-3">
        <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">
          Actions recommandées
        </p>
        <div className="mt-1.5 flex flex-col gap-1">
          {shown.actions.map((action) => {
            const Icon = actionIcon(action);
            return (
              <button
                key={action}
                type="button"
                onClick={() => runAction(action)}
                className="group flex items-center gap-2 rounded-lg border border-line/80 bg-white px-2 py-2 text-left transition hover:border-sage/25 hover:bg-sage-soft/40"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-cream-soft text-sage">
                  <Icon className="h-2.5 w-2.5" />
                </span>
                <span className="min-w-0 flex-1 text-[8.5px] font-semibold leading-tight text-ink">
                  {action}
                </span>
                <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted/70 transition group-hover:translate-x-0.5 group-hover:text-sage" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") ask();
          }}
          placeholder="Poser une question…"
          className="field h-8 min-w-0 flex-1 px-2.5 py-1 text-[8.5px]"
        />
        <button
          type="button"
          onClick={ask}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-petrol text-white transition hover:bg-petrol-dark"
          aria-label="Envoyer la question à l'assistant"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-2.5 flex items-start gap-1.5">
        <ShieldCheck className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted/60" />
        <p className="text-[7.5px] leading-relaxed text-muted/80">
          {ASSISTANT_DISCLAIMER}
        </p>
      </div>

      <a
        href="/assistant"
        className="mt-2 flex items-center justify-between rounded-lg bg-cream-soft px-2.5 py-2 text-[8px] font-semibold text-ink transition hover:bg-cream-dark"
      >
        Ouvrir l&apos;assistant complet
        <ArrowUpRight className="h-2.5 w-2.5 text-muted" />
      </a>
    </section>
  );
}
