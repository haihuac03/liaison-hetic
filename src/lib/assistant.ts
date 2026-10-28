import type { Negotiation, Ticket } from "./types";

export const ASSISTANT_DISCLAIMER =
  "Les avis de l'assistant sont à visée informative et facilitent le dialogue amiable sans remplacer un conseil juridique.";

export interface AssistantAnswer {
  tag: string;
  text: string;
  actions: string[];
  source?: string;
}

export const ASSISTANT_SUGGESTIONS = [
  "Quand mon loyer peut-il être révisé ?",
  "Qui doit payer le remplacement du siphon ?",
  "Quel est le délai de préavis à Paris ?",
  "Comment contester une retenue sur le dépôt de garantie ?",
  "Puis-je demander une régularisation des charges ?",
];

const DEFAULT_ANSWER: AssistantAnswer = {
  tag: "MÉDIATION AMIABLE",
  text: "Votre question peut généralement être traitée par un échange écrit et horodaté avec votre bailleur. Décrivez les faits, joignez les photos ou documents utiles, puis proposez une solution concrète. LIAISON conserve chaque échange dans le ticket partagé et peut vous aider à formuler un message neutre, factuel et courtois.",
  actions: ["Préparer un message", "Résumer le ticket", "Préparer une proposition"],
  source: "Protocole de conciliation LIAISON",
};

export function getTicketAssistant(ticket: Ticket): AssistantAnswer {
  if (ticket.id === "2841" || /fuite|siphon|plomb/i.test(ticket.title)) {
    return {
      tag: "DÉCRET 87-712",
      text: "Le remplacement du siphon ou des canalisations d'évacuation vétustes relève des grosses réparations à la charge exclusive du bailleur. Vérifiez la répartition prévue par le bail et les échanges du ticket.",
      actions: [],
      source: "Décret n° 87-712 du 26 août 1987 · art. 2",
    };
  }

  if (ticket.id === "2837" || ticket.negotiation || /révision|loyer|irl/i.test(ticket.title)) {
    return {
      tag: "IRL · LOI 89-462",
      text: "La révision annuelle est encadrée par l'indice IRL publié par l'INSEE. Comparez la date anniversaire, l’indice IRL applicable et les montants inscrits au bail.",
      actions: [],
      source: "Loi n° 89-462 du 6 juillet 1989 · art. 17",
    };
  }

  if (ticket.id === "2812") {
    return {
      tag: "RÉPARATIONS LOCATIVES",
      text: "Le moteur d'un volet roulant fait partie des équipements dont le remplacement incombe au bailleur lorsqu'il relève de la vétusté ou d'une panne mécanique. Le PV signé sans réserve et la facture archivée sécurisent la clôture du ticket.",
      actions: [],
      source: "Décret n° 87-712 · équipements",
    };
  }

  if (ticket.id === "2798") {
    return {
      tag: "LOI ALUR · ZONE TENDUE",
      text: "Paris est située en zone tendue. Pour un logement vide, le délai de préavis du locataire est réduit à un mois. Le congé doit être notifié par lettre recommandée avec accusé de réception, par acte d'huissier ou remis en main propre contre récépissé.",
      actions: [],
      source: "Loi ALUR du 24 mars 2014 · art. 15",
    };
  }

  return {
    tag: "ANALYSE DU TICKET",
    text: `Le ticket #${ticket.id.slice(0, 8)} est actuellement ${ticket.status === "en_cours" ? "en cours de traitement" : "suivi par LIAISON"}. Les échanges et pièces jointes sont horodatés. Une solution amiable peut être proposée sur la base des éléments déjà transmis.`,
    actions: ["Résumer le ticket", "Rédiger un message", "Proposer une solution"],
    source: "Protocole de conciliation LIAISON",
  };
}

export function getNegotiationAssistant(negotiation: Negotiation): AssistantAnswer {
  return {
    tag: "NÉGOCIATION · IRL",
    text: `La proposition du bailleur est de 1 080 €, soit +${negotiation.evolution.toFixed(2).replace(".", ",")} %. L'écart avec votre contre-proposition est de ${negotiation.gap} € / mois. Un accord à mi-parcours reste possible : formalisez le montant, la date d'effet et les conditions dans un écrit signé par les deux parties.`,
    actions: [
      "Calculer l'impact annuel",
      "Rédiger la réponse à Claire",
      "Préparer l'accord final",
    ],
    source: "Loi n° 89-462 du 6 juillet 1989 · art. 17",
  };
}

export function answerQuestion(
  question: string,
  context?: { ticket?: Ticket; documentName?: string },
): AssistantAnswer {
  const q = question.toLowerCase();
  const doc = context?.documentName?.toLowerCase() ?? "";

  if (/loyer|révis|revis|irl|augment/.test(q) || /bail|irl|révis/.test(doc)) {
    return {
      tag: "RÉVISION DU LOYER · IRL",
      text: "Le loyer peut être révisé une fois par an, à la date anniversaire prévue au bail, et uniquement si une clause de révision existe. La hausse est plafonnée à la variation de l'indice IRL de l'INSEE. Vérifiez la date anniversaire et l’indice applicable dans le bail. Aucune rétroactivité n’est possible sans accord écrit.",
      actions: [],
      source: "Loi n° 89-462 · art. 17-1",
    };
  }

  if (/fuite|siphon|plomb|répar|repar|travaux|décret|decret/.test(q) || /devis|plomb/.test(doc)) {
    return {
      tag: "DÉCRET 87-712 · TRAVAUX",
      text: "Les réparations liées à la vétusté des canalisations, du siphon ou des évacuations relèvent du bailleur. Les menues réparations d'entretien restent à la charge du locataire. Conservez les photos avant/après et les échanges sur la prise en charge.",
      actions: [],
      source: "Décret n° 87-712 du 26 août 1987",
    };
  }

  if (/préavis|preavis|départ|depart|congé|conge/.test(q)) {
    return {
      tag: "PRÉAVIS · LOI ALUR",
      text: "Dans les zones tendues, le préavis du locataire pour un logement vide peut être réduit à un mois. Il doit être notifié par lettre recommandée avec accusé de réception, acte d'huissier ou remise en main propre contre récépissé. Le délai court à partir de la réception, pas de l'envoi. Pensez à demander l'état des lieux de sortie et la restitution du dépôt de garantie.",
      actions: [],
      source: "Loi ALUR · art. 15",
    };
  }

  if (/dépôt|depot|garantie|caution/.test(q)) {
    return {
      tag: "DÉPÔT DE GARANTIE",
      text: "Le dépôt de garantie doit être restitué dans un délai de 1 mois si l'état des lieux de sortie est conforme, ou de 2 mois en cas de dégradations. Les retenues doivent être justifiées par un devis ou une facture. En cas de désaccord, une mise en demeure écrite et la commission départementale de conciliation peuvent être saisies.",
      actions: [],
      source: "Loi n° 89-462 · art. 22",
    };
  }

  if (/charge|régularisation|regularisation/.test(q)) {
    return {
      tag: "CHARGES LOCATIVES",
      text: "La régularisation annuelle des charges doit être accompagnée d'un décompte détaillé par nature de dépense. Vous pouvez demander les justificatifs au bailleur ou au syndic. Les provisions doivent rester proportionnées et être ajustées. Un trop-perçu doit vous être remboursé.",
      actions: [],
      source: "Loi n° 89-462 · art. 23",
    };
  }

  if (/vitrage|fenêtre|fenetre|isolation|humidité|humidite|chauffage/.test(q)) {
    return {
      tag: "LOGEABILITÉ & TRAVAUX",
      text: "Un double vitrage dégradé peut affecter la performance énergétique et le confort du logement. Si le désordre relève de la vétusté, une demande de travaux auprès du bailleur est légitime. Une contre-proposition sur le loyer peut mentionner ce point, mais elle reste un accord amiable : l'absence de travaux ne suspend pas automatiquement la révision légale.",
      actions: [],
      source: "Loi ELAN · décence du logement",
    };
  }

  if (/assurance|sinistre|dégât|degat/.test(q)) {
    return {
      tag: "ASSURANCE & SINISTRE",
      text: "Déclarez le sinistre à votre assureur habitation dans les 5 jours ouvrés en joignant le constat amiable et les photos. Si le dommage vient d'une canalisation commune, le syndic doit être informé. Conservez les échanges LIAISON : l’historique du ticket documente la chronologie.",
      actions: [],
      source: "Code des assurances · art. L113-2",
    };
  }

  if (/document|bail|clause|contrat|quittance/.test(q)) {
    return {
      tag: "LECTURE DU DOCUMENT",
      text: "Le bail contient les clauses de révision, de dépôt de garantie et de réparations. La clause de révision s'applique à la date anniversaire. La quittance prouve le paiement du loyer. Pour aller plus loin, posez une question sur un passage précis : montant, date, obligation ou délai.",
      actions: [],
      source: "Documents du logement",
    };
  }

  return DEFAULT_ANSWER;
}

export function summarizeTicket(ticket: Ticket) {
  return {
    facts: [
      `Ticket #${ticket.id} — ${ticket.title}`,
      `Statut : ${ticket.status}`,
      `Ouvert le ${ticket.createdAt}`,
      `Interlocuteur : ${ticket.assignee}`,
      ticket.negotiation
        ? `Négociation : ${ticket.negotiation.ownerProposal} € proposés, ${ticket.negotiation.tenantCounter ?? "—"} € en contre-proposition`
        : ticket.intervention
          ? `Intervention : ${ticket.intervention.date} · ${ticket.intervention.slot}`
          : "Aucune intervention programmée",
    ],
    next: ticket.negotiation
      ? "Formaliser l'accord écrit ou relancer le bailleur."
      : ticket.intervention
        ? "Confirmer la présence et préparer l'accès au meuble."
        : "Attendre la réponse du bailleur ou relancer.",
  };
}
