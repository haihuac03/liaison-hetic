import {
  FileText,
  Handshake,
  Home,
  MoreHorizontal,
  Scale,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TicketCategory, TicketStatus, Tone } from "./types";

export const STATUS_META: Record<
  TicketStatus,
  {
    label: string;
    short: string;
    tone: Tone;
    chip: string;
    dot: string;
    accent: string;
    description: string;
  }
> = {
  ouvert: {
    label: "Ouvert",
    short: "Ouvert",
    tone: "blue",
    chip: "bg-sky text-sky-dark",
    dot: "bg-sky-dark",
    accent: "bg-sky-dark",
    description: "Le dossier est ouvert aux deux parties.",
  },
  en_cours: {
    label: "En cours",
    short: "En cours",
    tone: "orange",
    chip: "bg-peach text-peach-dark",
    dot: "bg-[#C97B36]",
    accent: "bg-[#E0A16A]",
    description: "Une action est en cours de traitement.",
  },
  en_attente: {
    label: "En attente",
    short: "En attente",
    tone: "neutral",
    chip: "bg-cream-dark text-[#5F686B]",
    dot: "bg-[#8A9294]",
    accent: "bg-[#B7BCBD]",
    description: "Une réponse ou une pièce est attendue.",
  },
  en_litige: { label: "En litige", short: "Litige", tone: "orange", chip: "bg-peach text-peach-dark", dot: "bg-red-600", accent: "bg-red-600", description: "Un désaccord a été signalé dans ce dossier." },
  en_cloture: { label: "Clôture à confirmer", short: "Clôture", tone: "blue", chip: "bg-sky text-sky-dark", dot: "bg-sky-dark", accent: "bg-sky-dark", description: "Une demande de clôture attend la réponse de l’autre partie." },
  en_negociation: {
    label: "En négociation",
    short: "En négo",
    tone: "blue",
    chip: "bg-sky text-sky-dark",
    dot: "bg-[#4C7F96]",
    accent: "bg-[#4C7F96]",
    description: "Un échange amiable est en cours.",
  },
  resolu: {
    label: "Résolu",
    short: "Résolu",
    tone: "green",
    chip: "bg-sage-light text-sage-dark",
    dot: "bg-sage",
    accent: "bg-sage",
    description: "Le dossier a trouvé une issue favorable.",
  },
  ferme: {
    label: "Fermé",
    short: "Fermé",
    tone: "neutral",
    chip: "bg-cream-dark text-[#60696B]",
    dot: "bg-[#8B9294]",
    accent: "bg-[#AAB0B1]",
    description: "Le dossier est archivé.",
  },
};

export const STATUS_FLOW: TicketStatus[] = [
  "en_cours",
  "en_attente",
];

export const CATEGORY_META: Record<
  TicketCategory,
  { label: string; helper: string; icon: LucideIcon; tone: Tone }
> = {
  reparation: {
    label: "Problème / réparation",
    helper: "Panne, fuite, usure",
    icon: Wrench,
    tone: "blue",
  },
  desaccord: {
    label: "Désaccord",
    helper: "Médiation neutre",
    icon: Scale,
    tone: "neutral",
  },
  negociation: {
    label: "Négociation",
    helper: "Loyer, aménagement",
    icon: Handshake,
    tone: "orange",
  },
  contrat: {
    label: "Question contrat",
    helper: "Bail, avenant, clause",
    icon: FileText,
    tone: "blue",
  },
  loyer: {
    label: "Loyer / charges",
    helper: "Régularisation, quittance",
    icon: Wallet,
    tone: "blue",
  },
  logement: {
    label: "Demande logement",
    helper: "Travaux, clé, animal",
    icon: Home,
    tone: "green",
  },
  autre: {
    label: "Autre demande générale",
    helper: "Toute requête hors cadre",
    icon: MoreHorizontal,
    tone: "neutral",
  },
};

export const TONE_CLASSES: Record<Tone, { chip: string; tile: string; icon: string }> = {
  blue: {
    chip: "bg-sky text-sky-dark",
    tile: "bg-sky-soft",
    icon: "text-sky-dark",
  },
  orange: {
    chip: "bg-peach text-peach-dark",
    tile: "bg-peach-soft",
    icon: "text-peach-dark",
  },
  green: {
    chip: "bg-sage-light text-sage-dark",
    tile: "bg-sage-soft",
    icon: "text-sage",
  },
  neutral: {
    chip: "bg-cream-dark text-[#5F686B]",
    tile: "bg-cream-soft",
    icon: "text-[#697274]",
  },
  dark: {
    chip: "bg-petrol text-white",
    tile: "bg-petrol-soft",
    icon: "text-petrol",
  },
};
