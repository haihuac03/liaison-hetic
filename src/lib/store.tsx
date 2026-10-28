"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { coreRequest, mapCoreState, uploadAttachments, CoreAuthProvider, useCoreAuth } from "./client/core";
import { CATEGORY_META, STATUS_META } from "./meta";
import { INITIAL_DOCUMENTS, INITIAL_TICKETS, NOTIFICATIONS } from "./data";
import type {
  Agreement,
  ChatMessage,
  DocumentItem,
  EvidenceFile,
  NewTicketPayload,
  NotificationItem,
  Proposal,
  Ticket,
  TicketStatus,
} from "./types";



interface LiaisonState {
  tickets: Ticket[];
  documents: DocumentItem[];
  notifications: NotificationItem[];
}

interface CloseAgreementInput {
  subject: string;
  amount: string;
  conditions: string;
  documents: string[];
}

interface StoreValue extends LiaisonState {
  hydrated: boolean;
  addTicket: (payload: NewTicketPayload) => Promise<Ticket>;
  updateStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  sendMessage: (ticketId: string, text: string, attachments?: { src: string; alt: string; kind?: "image" | "file"; name?: string }[]) => Promise<void>;
  addReply: (ticketId: string, text: string, author?: "claire" | "artisan") => void;
  addDocumentToTicket: (ticketId: string, document: DocumentItem) => void;
  addDocument: (document: DocumentItem) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (ids?: string[]) => Promise<void>;
  acceptOwnerProposal: (ticketId: string) => void;
  refuseOwnerProposal: (ticketId: string) => void;
  sendCounterProposal: (ticketId: string, amount: number, message: string) => void;
  simulateOwnerAcceptance: (ticketId: string) => void;
  addInterventionEvidence: (ticketId: string, evidence: EvidenceFile) => void;
  closeTicketWithAgreement: (ticketId: string, input: CloseAgreementInput) => Agreement;
  reopenTicket: (ticketId: string) => void;
  resetDemo: () => void;
}

const LiaisonContext = createContext<StoreValue | null>(null);

function nowTime() {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nowDate() {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

function computeGeneratedMeta(amount: number, currentRent: number) {
  const evolution = Number((((amount - currentRent) / currentRent) * 100).toFixed(2));
  const gap = Math.abs(currentRent - amount);
  const proximity = Math.max(
    0,
    Math.min(100, Math.round(100 - (Math.abs(amount - 1080) / 35) * 35)),
  );
  return { evolution, gap, proximity };
}

export function LiaisonProvider({ children }: { children: ReactNode }) {
  return <CoreAuthProvider><LiaisonStateProvider>{children}</LiaisonStateProvider></CoreAuthProvider>;
}

function LiaisonStateProvider({ children }: { children: ReactNode }) {
  const session = useCoreAuth();
  const [state, setState] = useState<LiaisonState>({
    tickets: [],
    documents: [],
    notifications: [],
  });
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (session.loading) return;
    setState(session.core ? mapCoreState(session.core) : { tickets: [], documents: [], notifications: [] });
    setHydrated(true);
  }, [session.core, session.loading]);

  const patchTicket = useCallback(
    (ticketId: string, updater: (ticket: Ticket) => Ticket) => {
      setState((prev) => ({
        ...prev,
        tickets: prev.tickets.map((ticket) =>
          ticket.id === ticketId ? updater(ticket) : ticket,
        ),
      }));
    },
    [],
  );

  const addTicket = useCallback(async (payload: NewTicketPayload): Promise<Ticket> => {
    if (session.core) {
      const propertyId = payload.propertyId || session.core.properties.find(property => Boolean(property.tenant_id))?.id;
      if (!propertyId) throw new Error("Rejoignez un logement avant de créer un ticket.");
      const created = await coreRequest<{ id: string }>("ticket", { ...payload, propertyId });
      try {
        await uploadAttachments(created.id, payload.attachments.map((item, index) => typeof item === "string" ? { src: item, alt: `Pièce jointe ${index + 1}`, name: `piece-${index + 1}` } : item));
      } catch (error) {
        await session.refresh();
        throw Object.assign(new Error(`Le ticket a été créé, mais une pièce jointe a échoué : ${error instanceof Error ? error.message : "réessayez depuis le dossier"}`), { ticketId: created.id });
      }
      const core = await coreRequest<import("./client/core").CoreState>("state");
      const mapped = mapCoreState(core);
      setState(mapped);
      await session.refresh();
      return mapped.tickets.find(ticket => ticket.id === created.id)!;
    }
    const numericIds = stateRef.current.tickets.map((t) => Number(t.id)).filter(Number.isFinite);
    const id = String(Math.max(2841, ...numericIds) + 1);
    const category = CATEGORY_META[payload.category];
    const time = nowTime();
    const attachments = payload.attachments.map((src, index) => ({
      src: typeof src === "string" ? src : src.src,
      alt: typeof src === "string" ? `Pièce jointe ${index + 1}` : src.alt,
    }));
    const created: Ticket = {
      id,
      title: payload.title,
      shortTitle: payload.title,
      category: payload.category,
      status: "ouvert",
      badge: "Nouveau dossier",
      badgeTone: "blue",
      createdAt: `${nowDate()} à ${time}`,
      updatedAt: "À l'instant",
      description: payload.description,
      summary: payload.description,
      progress: { step: 1, total: 5, label: "Demande transmise", date: `${nowDate()}` },
      assignee: "Claire Bernard",
      photos: attachments.map((a) => a.src),
      messages: [
        {
          id: uid("msg"),
          author: "thomas",
          authorName: "Thomas Martin",
          time,
          text: payload.description || "Nouvelle demande transmise via LIAISON.",
          attachments: attachments.length ? attachments : undefined,
        },
        {
          id: uid("msg"),
          author: "system",
          authorName: "LIAISON",
          time,
          text: `Dossier transmis à Claire Bernard · motif : ${category.label}.`,
          system: true,
        },
      ],
      timeline: [
        {
          id: uid("step"),
          title: "Ticket créé",
          meta: `${nowDate()} ${time}`,
          detail: "Thomas Martin signale la demande",
          state: "done",
        },
        {
          id: uid("step"),
          title: "Propriétaire informé",
          meta: "En cours d'envoi",
          detail: "Claire Bernard recevra une notification",
          state: "current",
        },
        {
          id: uid("step"),
          title: "Qualification du dossier",
          detail: "Analyse du motif et des pièces",
          state: "locked",
        },
        {
          id: uid("step"),
          title: "Proposition de solution",
          detail: "Échange amiable avec le bailleur",
          state: "locked",
        },
        {
          id: uid("step"),
          title: "Clôture & archivage",
          detail: "Historique horodaté des échanges",
          state: "locked",
        },
      ],
      documents: attachments.map((attachment, index) => ({
        id: uid("doc"),
        name: `Piece_jointe_${index + 1}.${attachment.src.startsWith("data:image") ? "jpg" : "pdf"}`,
        meta: "Ajouté à l'instant",
        size: "—",
        type: attachment.src.startsWith("data:image") ? "image" : "pdf",
        preview: attachment.src.startsWith("data:image")
          ? attachment.src
          : "/images/doc-constat.svg",
        date: nowDate(),
      })),
      unread: 0,
    };

    setState((prev) => ({
      ...prev,
      tickets: [created, ...prev.tickets],
      notifications: [
        {
          id: uid("notif"),
          title: "Nouveau dossier créé",
          detail: `Ticket #${id} — ${payload.title}`,
          time: "À l'instant",
          read: false,
          href: `/tickets/${id}`,
          type: "ticket",
        },
        ...prev.notifications,
      ],
    }));

    return created;
  }, [session.core, session.refresh]);

  const updateStatus = useCallback(
    async (ticketId: string, status: TicketStatus) => {
      if (session.core) {
        await coreRequest("status", { ticketId, status, expectedVersion: stateRef.current.tickets.find(t => t.id === ticketId)?.version });
        await session.refresh();
        return;
      }
      const time = nowTime();
      patchTicket(ticketId, (ticket) => {
        const meta = STATUS_META[status];
        const final = status === "resolu" || status === "ferme";
        const timeline = ticket.timeline.map((step) => {
          if (!final) return step;
          return { ...step, state: "done" as const };
        });
        return {
          ...ticket,
          status,
          badge:
            status === "resolu"
              ? "Résolu"
              : status === "ferme"
                ? "Fermé"
                : meta.label,
          badgeTone: meta.tone,
          updatedAt: "À l'instant",
          closedAt: final ? `${nowDate()}` : ticket.closedAt,
          progress: final
            ? { ...ticket.progress, step: ticket.progress.total, label: meta.label }
            : ticket.progress,
          timeline,
          messages: [
            ...ticket.messages,
            {
              id: uid("msg"),
              author: "system",
              authorName: "LIAISON",
              time,
              text: `Statut du dossier mis à jour : ${meta.label.toLowerCase()}.`,
              system: true,
            },
          ],
        };
      });
    },
    [patchTicket, session.core, session.refresh],
  );

  const sendMessage = useCallback(
    async (
      ticketId: string,
      text: string,
      attachments?: { src: string; alt: string; kind?: "image" | "file"; name?: string }[],
    ) => {
      if (session.core) {
        const message = await coreRequest<{ id: string }>("message", { ticketId, text: text.trim() || "Pièce jointe" });
        try { await uploadAttachments(ticketId, attachments || [], message.id); }
        finally { await session.refresh(); }
        return;
      }
      const time = nowTime();
      patchTicket(ticketId, (ticket) => {
        const message: ChatMessage = {
          id: uid("msg"),
          author: "thomas",
          authorName: "Thomas Martin",
          time,
          text: text.trim(),
          attachments,
        };
        return {
          ...ticket,
          updatedAt: "À l'instant",
          messages: [...ticket.messages, message],
          photos:
            attachments?.length && ticket.photos.length < 6
              ? [...ticket.photos, ...attachments.map((a) => a.src)].slice(0, 6)
              : ticket.photos,
        };
      });
    },
    [patchTicket, session.core, session.refresh],
  );

  const addReply = useCallback(
    (ticketId: string, text: string, author: "claire" | "artisan" = "claire") => {
      const time = nowTime();
      patchTicket(ticketId, (ticket) => ({
        ...ticket,
        updatedAt: "À l'instant",
        messages: [
          ...ticket.messages,
          {
            id: uid("msg"),
            author,
            authorName: author === "claire" ? "Claire Bernard" : "Plomberie Martin S.A.S.",
            role: author === "claire" ? "Bailleur" : "Artisan",
            time,
            text,
          },
        ],
      }));
    },
    [patchTicket],
  );

  const addDocument = useCallback((document: DocumentItem) => {
    setState((prev) => ({
      ...prev,
      documents: [document, ...prev.documents],
    }));
  }, []);

  const addDocumentToTicket = useCallback(
    (ticketId: string, document: DocumentItem) => {
      patchTicket(ticketId, (ticket) => ({
        ...ticket,
        updatedAt: "À l'instant",
        documents: [
          {
            id: document.id,
            name: document.name,
            meta: document.status ?? "Ajouté à l'instant",
            size: document.size,
            type: document.type,
            preview: document.preview,
            date: document.date,
            status: document.status,
          },
          ...ticket.documents,
        ],
      }));
      addDocument(document);
    },
    [addDocument, patchTicket],
  );

  const markNotificationRead = useCallback((id: string) => {
    if (session.core) {
      void coreRequest("read", { id }).then(() => session.refresh()).catch(() => session.refresh());
      return;
    }
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  }, [session.core, session.refresh]);

  const markAllNotificationsRead = useCallback(async (ids?: string[]) => {
    const selected = new Set(ids ?? session.core?.notifications.map((item) => item.id) ?? stateRef.current.notifications.map((item) => item.id));
    if (session.core) {
      await Promise.all(session.core.notifications.filter((item) => !item.read && selected.has(item.id)).map((item) => coreRequest("read", { id: item.id })));
      await session.refresh();
      return;
    }
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => selected.has(n.id) ? { ...n, read: true } : n),
    }));
  }, [session.core, session.refresh]);

  const acceptOwnerProposal = useCallback(
    (ticketId: string) => {
      const time = nowTime();
      patchTicket(ticketId, (ticket) => {
        if (!ticket.negotiation) return ticket;
        const proposals = ticket.negotiation.proposals.map((proposal) => {
          if (proposal.author === "claire") {
            return { ...proposal, status: "accepted" as const };
          }
          return proposal.author === "thomas" && proposal.status === "pending"
            ? { ...proposal, status: "superseded" as const }
            : proposal;
        });
        return {
          ...ticket,
          updatedAt: "À l'instant",
          badge: "Accord trouvé",
          badgeTone: "green",
          negotiation: {
            ...ticket.negotiation,
            status: "agreement",
            proposals,
            lastUpdate: "À l'instant",
          },
          timeline: ticket.timeline.map((step, index) =>
            index === ticket.timeline.length - 1
              ? { ...step, state: "current" as const }
              : { ...step, state: "done" as const },
          ),
          messages: [
            ...ticket.messages,
            {
              id: uid("msg"),
              author: "system",
              authorName: "LIAISON",
              time,
              text: "Accord trouvé : Thomas Martin a accepté la proposition de 1 080 € / mois. La clôture avec accord est disponible.",
              system: true,
            },
          ],
        };
      });
    },
    [patchTicket],
  );

  const refuseOwnerProposal = useCallback(
    (ticketId: string) => {
      const time = nowTime();
      patchTicket(ticketId, (ticket) => {
        if (!ticket.negotiation) return ticket;
        return {
          ...ticket,
          updatedAt: "À l'instant",
          negotiation: {
            ...ticket.negotiation,
            status: "open",
            proposals: ticket.negotiation.proposals.map((proposal) =>
              proposal.author === "claire"
                ? { ...proposal, status: "refused" as const }
                : proposal,
            ),
            lastUpdate: "À l'instant",
          },
          messages: [
            ...ticket.messages,
            {
              id: uid("msg"),
              author: "system",
              authorName: "LIAISON",
              time,
              text: "Thomas Martin a refusé la proposition à 1 080 €. Une contre-proposition peut être formulée.",
              system: true,
            },
          ],
        };
      });
    },
    [patchTicket],
  );

  const sendCounterProposal = useCallback(
    (ticketId: string, amount: number, message: string) => {
      const time = nowTime();
      patchTicket(ticketId, (ticket) => {
        if (!ticket.negotiation) return ticket;
        const meta = computeGeneratedMeta(amount, ticket.negotiation.currentRent);
        const proposal: Proposal = {
          id: uid("prop"),
          author: "thomas",
          authorName: "Thomas Martin",
          role: "Locataire",
          amount,
          previousAmount: ticket.negotiation.currentRent,
          date: `${nowDate()} · ${time}`,
          message,
          status: "pending",
        };
        const proposals = ticket.negotiation.proposals.map((p) =>
          p.author === "thomas" && p.status === "pending"
            ? { ...p, status: "superseded" as const }
            : p,
        );
        return {
          ...ticket,
          updatedAt: "À l'instant",
          badge: "Contre-proposition envoyée",
          badgeTone: "orange",
          negotiation: {
            ...ticket.negotiation,
            tenantCounter: amount,
            evolution: meta.evolution,
            gap: meta.gap,
            proximity: meta.proximity,
            proposals: [...proposals, proposal],
            lastUpdate: "À l'instant",
          },
          messages: [
            ...ticket.messages,
            {
              id: uid("msg"),
              author: "thomas",
              authorName: "Thomas Martin",
              time,
              text: message,
              proposalId: proposal.id,
            },
            {
              id: uid("msg"),
              author: "system",
              authorName: "LIAISON",
              time,
              text: `Contre-proposition de ${amount.toLocaleString("fr-FR")} € / mois envoyée à Claire Bernard.`,
              system: true,
            },
          ],
        };
      });
    },
    [patchTicket],
  );

  const simulateOwnerAcceptance = useCallback(
    (ticketId: string) => {
      const time = nowTime();
      patchTicket(ticketId, (ticket) => {
        if (!ticket.negotiation) return ticket;
        return {
          ...ticket,
          updatedAt: "À l'instant",
          badge: "Accord trouvé",
          badgeTone: "green",
          negotiation: {
            ...ticket.negotiation,
            status: "agreement",
            proposals: ticket.negotiation.proposals.map((proposal) =>
              proposal.author === "thomas" && proposal.status === "pending"
                ? { ...proposal, status: "accepted" as const }
                : proposal,
            ),
            lastUpdate: "À l'instant",
          },
          timeline: ticket.timeline.map((step) =>
            step.id === "n7" ? { ...step, state: "current" as const } : step,
          ),
          messages: [
            ...ticket.messages,
            {
              id: uid("msg"),
              author: "claire",
              authorName: "Claire Bernard",
              role: "Bailleur",
              time,
              text: "Merci Thomas, votre proposition me convient. J'accepte le montant de " + (ticket.negotiation.tenantCounter ?? 1065).toLocaleString("fr-FR") + " € / mois. Nous pouvons clôturer le dossier avec accord.",
            },
            {
              id: uid("msg"),
              author: "system",
              authorName: "LIAISON",
              time,
              text: "Accord trouvé — les deux parties ont accepté la contre-proposition. La clôture avec accord est disponible.",
              system: true,
            },
          ],
        };
      });
    },
    [patchTicket],
  );

  const addInterventionEvidence = useCallback(
    (ticketId: string, evidence: EvidenceFile) => {
      patchTicket(ticketId, (ticket) => {
        if (!ticket.intervention) return ticket;
        return {
          ...ticket,
          updatedAt: "À l'instant",
          intervention: {
            ...ticket.intervention,
            evidence: [evidence, ...ticket.intervention.evidence],
          },
        };
      });
    },
    [patchTicket],
  );

  const closeTicketWithAgreement = useCallback(
    (ticketId: string, input: CloseAgreementInput): Agreement => {
      const time = nowTime();
      const agreement: Agreement = {
        id: `AGR-${ticketId}`,
        date: nowDate(),
        parties: "Claire Bernard & Thomas Martin",
        subject: input.subject,
        amount: input.amount,
        conditions: input.conditions,
        documents: input.documents,
        createdAt: `${nowDate()} · ${time}`,
      };
      patchTicket(ticketId, (ticket) => ({
        ...ticket,
        status: "resolu",
        badge: "Accord signé",
        badgeTone: "green",
        closedAt: nowDate(),
        updatedAt: "À l'instant",
        agreement,
        progress: { ...ticket.progress, step: ticket.progress.total, label: "Clôturé avec accord" },
        negotiation: ticket.negotiation
          ? { ...ticket.negotiation, status: "agreement" }
          : ticket.negotiation,
        timeline: ticket.timeline.map((step) => ({ ...step, state: "done" as const })),
        messages: [
          ...ticket.messages,
          {
            id: uid("msg"),
            author: "system",
            authorName: "LIAISON",
            time,
            text: `Accord ${agreement.id} signé et horodaté. Le dossier est clôturé et archivé.`,
            system: true,
          },
        ],
      }));
      setState((prev) => ({
        ...prev,
        documents: [
          {
            id: `accord-${ticketId}-${Date.now()}`,
            name: `Accord_${agreement.id}.pdf`,
            category: "Accords",
            size: "96 Ko",
            date: nowDate(),
            preview: "/images/doc-constat.svg",
            type: "pdf",
            status: "Signé",
            description: `Accord amiable ${agreement.id} — ${input.subject}`,
            ticketId,
            certified: true,
          },
          ...prev.documents,
        ],
        notifications: [
          {
            id: uid("notif"),
            title: "Accord signé et dossier clôturé",
            detail: `${agreement.id} — ${input.subject}`,
            time: "À l'instant",
            read: false,
            href: `/tickets/${ticketId}`,
            type: "document",
          },
          ...prev.notifications,
        ],
      }));
      return agreement;
    },
    [patchTicket],
  );

  const reopenTicket = useCallback(
    (ticketId: string) => {
      const time = nowTime();
      patchTicket(ticketId, (ticket) => ({
        ...ticket,
        status: "en_cours",
        badge: "Réouvert",
        badgeTone: "orange",
        closedAt: undefined,
        updatedAt: "À l'instant",
        progress: { ...ticket.progress, step: Math.max(1, ticket.progress.total - 2), label: "Dossier réouvert" },
        timeline: ticket.timeline.map((step, index) =>
          index === ticket.timeline.length - 1
            ? { ...step, state: "locked" as const }
            : step,
        ),
        messages: [
          ...ticket.messages,
          {
            id: uid("msg"),
            author: "system",
            authorName: "LIAISON",
            time,
            text: "Le dossier a été réouvert. Les échanges reprennent et restent horodatés.",
            system: true,
          },
        ],
      }));
    },
    [patchTicket],
  );

  const resetDemo = useCallback(() => {
    setState({
      tickets: INITIAL_TICKETS,
      documents: INITIAL_DOCUMENTS,
      notifications: NOTIFICATIONS,
    });
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      hydrated,
      addTicket,
      updateStatus,
      sendMessage,
      addReply,
      addDocumentToTicket,
      addDocument,
      markNotificationRead,
      markAllNotificationsRead,
      acceptOwnerProposal,
      refuseOwnerProposal,
      sendCounterProposal,
      simulateOwnerAcceptance,
      addInterventionEvidence,
      closeTicketWithAgreement,
      reopenTicket,
      resetDemo,
    }),
    [
      state,
      hydrated,
      addTicket,
      updateStatus,
      sendMessage,
      addReply,
      addDocumentToTicket,
      addDocument,
      markNotificationRead,
      markAllNotificationsRead,
      acceptOwnerProposal,
      refuseOwnerProposal,
      sendCounterProposal,
      simulateOwnerAcceptance,
      addInterventionEvidence,
      closeTicketWithAgreement,
      reopenTicket,
      resetDemo,
    ],
  );

  return <LiaisonContext.Provider value={value}>{children}</LiaisonContext.Provider>;
}

export function useLiaison() {
  const context = useContext(LiaisonContext);
  if (!context) throw new Error("useLiaison must be used inside LiaisonProvider");
  return context;
}

export function getTicketStats(tickets: Ticket[]) {
  return {
    total: tickets.length,
    active: tickets.filter((t) => t.status === "en_cours").length,
    negotiating: tickets.filter((t) => t.status === "en_negociation").length,
    open: tickets.filter((t) => t.status === "ouvert").length,
    waiting: tickets.filter((t) => t.status === "en_attente").length,
    resolved: tickets.filter((t) => t.status === "resolu").length,
    closed: tickets.filter((t) => t.status === "ferme").length,
  };
}
