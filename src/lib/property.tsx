"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type AuthProperty } from "./auth";
import { useLiaison } from "./store";
import { rowsFor, rowStatus, rowText } from "@/components/tickets/workflow";
import type { Ticket } from "./types";

type PropertyContextValue = {
  activePropertyId: string | null;
  activeProperty: AuthProperty | null;
  setActiveProperty: (propertyId: string) => void;
  scopedTickets: Ticket[];
  allTickets: Ticket[];
};

export type TicketAttention = {
  owner: "you" | "other" | "neutral";
  label: string;
  detail: string;
};

const PropertyContext = createContext<PropertyContextValue | null>(null);

function storageKey(userId: string) {
  return `liaison-active-property:${userId}`;
}

function latestRow(ticket: Ticket, key: "interventions" | "closures" | "disputes") {
  return [...rowsFor(ticket, key)].sort((a, b) => {
    const aTime = Number(a.created_at ?? a.createdAt ?? 0);
    const bTime = Number(b.created_at ?? b.createdAt ?? 0);
    return bTime - aTime;
  })[0];
}

export function ticketAttention(
  ticket: Ticket,
  userId: string | undefined,
  role: "owner" | "tenant" | undefined,
): TicketAttention {
  if (["ferme", "resolu"].includes(ticket.status)) {
    return { owner: "neutral", label: "Dossier clôturé", detail: "Aucune action en attente" };
  }

  const closure = latestRow(ticket, "closures");
  if (closure && ["pending", "open", "en_attente", "en_cloture"].includes(rowStatus(closure))) {
    const requesterId = rowText(closure, "requester_id", "proposer_id");
    return requesterId && requesterId !== userId
      ? { owner: "you", label: "Clôture à confirmer", detail: "Une décision vous est demandée" }
      : { owner: "other", label: "Clôture en attente", detail: "En attente de l’autre partie" };
  }

  const intervention = latestRow(ticket, "interventions");
  const interventionStatus = rowStatus(intervention);
  if (interventionStatus) {
    if (["proposed", "pending"].includes(interventionStatus)) {
      return role === "tenant"
        ? { owner: "you", label: "Intervention à examiner", detail: "Accepter ou refuser la proposition" }
        : { owner: "other", label: "Intervention en attente", detail: "En attente de la décision du locataire" };
    }
    if (interventionStatus === "accepted") {
      return role === "owner"
        ? { owner: "you", label: "Intervention à réaliser", detail: "Déclarer la réalisation et son compte rendu" }
        : { owner: "other", label: "Intervention en cours", detail: "En attente du compte rendu du propriétaire" };
    }
    if (["completed", "awaiting_confirmation"].includes(interventionStatus)) {
      return role === "tenant"
        ? { owner: "you", label: "Réalisation à confirmer", detail: "Confirmer ou contester l’intervention" }
        : { owner: "other", label: "Confirmation attendue", detail: "En attente du locataire" };
    }
    if (interventionStatus === "contested") {
      return role === "owner"
        ? { owner: "you", label: "Contestation à traiter", detail: "Proposer une correction" }
        : { owner: "other", label: "Correction attendue", detail: "En attente du propriétaire" };
    }
  }

  const dispute = latestRow(ticket, "disputes");
  if (dispute && ["open", "active", "en_litige"].includes(rowStatus(dispute))) {
    return { owner: "neutral", label: "Litige ouvert", detail: "Le dossier est en attente de médiation" };
  }

  if (ticket.status === "en_attente") {
    return { owner: "neutral", label: "Réponse attendue", detail: "Le prochain geste dépend des échanges" };
  }

  return { owner: "neutral", label: "Dossier à suivre", detail: "Aucune action urgente identifiée" };
}

export function PropertyProvider({ children }: { children: ReactNode }) {
  const { user, properties } = useAuth();
  const { tickets } = useLiaison();
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setActivePropertyId(null);
      return;
    }

    const key = storageKey(user.id);
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(key);
    } catch {
      // A privacy-restricted browser can still use the first property.
    }

    const next = properties.some((property) => property.id === stored)
      ? stored
      : properties[0]?.id ?? null;
    setActivePropertyId(next);
    if (next) {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // Persistence is optional; the in-memory context remains usable.
      }
    }
  }, [properties, user]);

  const setActiveProperty = useCallback(
    (propertyId: string) => {
      if (!user || !properties.some((property) => property.id === propertyId)) return;
      setActivePropertyId(propertyId);
      try {
        window.localStorage.setItem(storageKey(user.id), propertyId);
      } catch {
        // Keep the selection for the current session.
      }
    },
    [properties, user],
  );

  const activeProperty = useMemo(
    () => properties.find((property) => property.id === activePropertyId) ?? null,
    [activePropertyId, properties],
  );
  const scopedTickets = useMemo(
    () =>
      activePropertyId
        ? tickets.filter((ticket) => ticket.propertyId === activePropertyId)
        : [],
    [activePropertyId, tickets],
  );

  const value = useMemo<PropertyContextValue>(
    () => ({
      activePropertyId,
      activeProperty,
      setActiveProperty,
      scopedTickets,
      allTickets: tickets,
    }),
    [activeProperty, activePropertyId, scopedTickets, setActiveProperty, tickets],
  );

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (!context) throw new Error("useProperty doit être utilisé dans PropertyProvider");
  return context;
}
