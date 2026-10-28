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
import type { TicketCategory, ToastMessage } from "./types";
import { useAuth } from "./auth";

interface UIContextValue {
  newTicketOpen: boolean;
  newTicketPreset?: TicketCategory;
  searchOpen: boolean;
  mobileNavOpen: boolean;
  toasts: ToastMessage[];
  openNewTicket: (preset?: TicketCategory) => void;
  closeNewTicket: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setMobileNavOpen: (open: boolean) => void;
  showToast: (title: string, detail?: string, tone?: ToastMessage["tone"]) => void;
  dismissToast: (id: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newTicketPreset, setNewTicketPreset] = useState<TicketCategory | undefined>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (title: string, detail?: string, tone: ToastMessage["tone"] = "success") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-2), { id, title, detail, tone }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 4600);
    },
    [],
  );

  const openNewTicket = useCallback((preset?: TicketCategory) => {
    if (!user) {
      showToast("Connexion requise", "Connectez-vous pour ouvrir un ticket.", "info");
      return;
    }
    setNewTicketPreset(preset);
    setNewTicketOpen(true);
    setMobileNavOpen(false);
  }, [showToast, user]);

  const closeNewTicket = useCallback(() => setNewTicketOpen(false), []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setMobileNavOpen(false);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const anyModalOpen = newTicketOpen || searchOpen;

  useEffect(() => {
    if (!anyModalOpen) return;
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [anyModalOpen]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      newTicketOpen,
      newTicketPreset,
      searchOpen,
      mobileNavOpen,
      toasts,
      openNewTicket,
      closeNewTicket,
      openSearch,
      closeSearch,
      setMobileNavOpen,
      showToast,
      dismissToast,
    }),
    [
      newTicketOpen,
      newTicketPreset,
      searchOpen,
      mobileNavOpen,
      toasts,
      openNewTicket,
      closeNewTicket,
      openSearch,
      closeSearch,
      showToast,
      dismissToast,
    ],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside UIProvider");
  return context;
}
