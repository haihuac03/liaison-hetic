export type TicketStatus =
  | "ouvert"
  | "en_cours"
  | "en_attente"
  | "en_litige"
  | "en_cloture"
  | "en_negociation"
  | "resolu"
  | "ferme";

export type TicketCategory =
  | "reparation"
  | "desaccord"
  | "negociation"
  | "contrat"
  | "loyer"
  | "logement"
  | "autre";

export type Tone = "blue" | "orange" | "green" | "neutral" | "dark";

export type AuthorId = "thomas" | "claire" | "artisan" | "agence" | "assistant" | "system";

export interface Attachment {
  src: string;
  alt: string;
  kind?: "image" | "file";
  name?: string;
}

export interface ChatMessage {
  isOwn?: boolean;
  initials?: string;
  id: string;
  author: AuthorId;
  authorName: string;
  role?: string;
  time: string;
  text: string;
  attachments?: Attachment[];
  system?: boolean;
  proposalId?: string;
}

export interface TimelineStep {
  id: string;
  title: string;
  meta?: string;
  detail?: string;
  state: "done" | "current" | "locked";
  badge?: string;
}

export interface Proposal {
  id: string;
  author: "thomas" | "claire";
  authorName: string;
  role: string;
  amount: number;
  previousAmount?: number;
  date: string;
  message: string;
  status: "pending" | "accepted" | "refused" | "superseded";
}

export interface Negotiation {
  currentRent: number;
  ownerProposal: number;
  tenantCounter?: number;
  evolution: number;
  gap: number;
  proximity: number;
  status: "open" | "agreement" | "refused";
  proposals: Proposal[];
  lastUpdate: string;
}

export interface InterventionStep {
  id: string;
  label: string;
  detail?: string;
  state: "done" | "current" | "todo";
}

export interface EvidenceFile {
  id: string;
  name: string;
  type: "photo" | "devis" | "facture" | "compte-rendu" | "signature";
  date: string;
  preview?: string;
}

export interface Intervention {
  id: string;
  artisan: string;
  date: string;
  slot: string;
  address: string;
  status: "planned" | "in_progress" | "done";
  steps: InterventionStep[];
  evidence: EvidenceFile[];
}

export interface LinkedDocument {
  id: string;
  name: string;
  meta: string;
  size: string;
  type: "pdf" | "image";
  preview: string;
  date: string;
  status?: string;
}

export interface Agreement {
  id: string;
  date: string;
  parties: string;
  subject: string;
  amount: string;
  conditions: string;
  documents: string[];
  createdAt: string;
}

export interface Ticket {
  createdTimestamp?: number;
  updatedTimestamp?: number;
  version?: number;
  ownerId?: string;
  tenantId?: string;
  creatorId?: string;
  propertyId?: string;
  address?: string;
  correspondentRole?: string;
  id: string;
  title: string;
  shortTitle: string;
  category: TicketCategory;
  status: TicketStatus;
  badge: string;
  badgeTone: Tone;
  createdAt: string;
  updatedAt: string;
  description: string;
  summary: string;
  progress: { step: number; total: number; label: string; date?: string };
  assignee: string;
  photos: string[];
  messages: ChatMessage[];
  timeline: TimelineStep[];
  documents: LinkedDocument[];
  negotiation?: Negotiation;
  intervention?: Intervention;
  agreement?: Agreement;
  closedAt?: string;
  priority?: boolean;
  unread?: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  category:
    | "Bail"
    | "États des lieux"
    | "Quittances"
    | "Devis"
    | "Factures"
    | "Photos"
    | "Accords"
    | "Constats";
  size: string;
  date: string;
  preview: string;
  type: "pdf" | "image";
  status?: string;
  amount?: string;
  ticketId?: string;
  description: string;
  certified?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  subtitle: string;
  avatar?: string;
  initials: string;
  color: "petrol" | "sage" | "peach" | "sky";
  online?: boolean;
  rating?: number;
  certified?: boolean;
  phone?: string;
  email?: string;
  lastContact?: string;
  tag?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
  href: string;
  type: "message" | "ticket" | "document" | "system";
}

export interface ToastMessage {
  id: string;
  title: string;
  detail?: string;
  tone?: "success" | "info" | "warning";
}

export interface NewTicketPayload {
  propertyId?: string;
  title: string;
  description: string;
  category: TicketCategory;
  attachments: (string | Attachment)[];
}
