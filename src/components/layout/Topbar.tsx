"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  FileText,
  Menu,
  MessageSquare,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLiaison } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import RoleBadge from "./RoleBadge";
import { useProperty } from "@/lib/property";

const notificationIcons = {
  message: MessageSquare,
  ticket: Ticket,
  document: FileText,
  system: ShieldCheck,
};

export default function Topbar() {
  const router = useRouter();
  const {user, properties} = useAuth();
  const { activeProperty, activePropertyId, allTickets, scopedTickets, setActiveProperty } = useProperty();
  const { openNewTicket, openSearch, setMobileNavOpen } = useUI();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useLiaison();
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scopedNotifications = useMemo(() => {
    const ids = new Set(scopedTickets.map((ticket) => ticket.id));
    return notifications.filter((notification) => {
      const match = notification.href.match(/^\/tickets\/([^/?#]+)/);
      return Boolean(match && ids.has(match[1]));
    });
  }, [notifications, scopedTickets]);
  const unread = scopedNotifications.filter((n) => !n.read).length;
  const role = user?.role ?? "tenant";

  useEffect(() => {
    if (!panelOpen) return;
    const onDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panelOpen]);

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-[112px] border-b border-[#E8E7E0] bg-cream/90 backdrop-blur-xl sm:h-[84px] lg:left-[264px]">
      <div className="mx-auto flex h-full w-full max-w-[1380px] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-7">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="icon-btn h-9 w-9 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          onClick={openSearch}
          className="icon-btn h-10 w-10 shrink-0 sm:hidden"
          aria-label="Rechercher dans le logement actif"
        >
          <Search className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </button>

        <button
          type="button"
          onClick={openSearch}
          className="group hidden h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl bg-white/60 px-3 text-left text-[12px] text-muted shadow-[inset_0_0_0_1px_rgba(231,230,223,0.8)] transition hover:bg-white sm:flex sm:max-w-[300px] xl:max-w-[390px]"
        >
          <Search className="h-[17px] w-[17px] shrink-0 text-[#6F7779]" strokeWidth={1.9} />
          <span className="truncate">Rechercher dans le logement actif...</span>
          <span className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border border-line bg-white px-1.5 py-0.5 text-[9px] font-semibold text-muted sm:flex">
            ⌘ K
          </span>
        </button>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
          <div className="flex min-w-0 max-w-[265px] flex-1 flex-col items-end sm:items-start" aria-label="Rôle et logement actif">
            <div className="flex items-center gap-1.5">
              <RoleBadge role={role} />
              <span className="hidden text-[9px] font-bold uppercase tracking-[0.1em] text-muted lg:inline">Logement actif</span>
            </div>
            {properties.length > 1 ? (
              <div className="relative mt-1 w-full max-w-[245px]">
                <label htmlFor="active-property" className="sr-only">Logement actif</label>
                <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" aria-hidden="true" />
                <select
                  id="active-property"
                  value={activePropertyId ?? ""}
                  onChange={(event) => setActiveProperty(event.target.value)}
                  className="h-7 w-full appearance-none truncate rounded-lg border border-line bg-white/75 pl-7 pr-7 text-[10px] font-semibold text-ink outline-none transition hover:bg-white focus:border-petrol/30"
                  aria-label="Choisir le logement actif"
                >
                  {properties.map((property) => <option key={property.id} value={property.id}>{property.address}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" aria-hidden="true" />
              </div>
            ) : (
              <Link
                href="/logements"
                className="mt-1 flex max-w-full items-center gap-1 truncate rounded-lg px-1 text-[10px] font-semibold text-muted transition hover:text-petrol"
                title={activeProperty?.address || "Aucun logement actif"}
              >
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{activeProperty?.address || "Aucun logement actif"}</span>
              </Link>
            )}
          </div>

          {user && (
            <button
              type="button"
              onClick={() => openNewTicket()}
              disabled={!activeProperty || (role === "owner" && !activeProperty.tenant_id)}
              className="btn-dark hidden h-10 px-3.5 xl:inline-flex"
              title={!activeProperty ? "Sélectionnez un logement" : role === "owner" && !activeProperty.tenant_id ? "Ce logement doit d’abord être relié à un locataire" : undefined}
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              <span>{role === "owner" ? "Créer un dossier" : "Signaler un problème"}</span>
            </button>
          )}

          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className={cn("icon-btn relative h-10 w-10", panelOpen && "bg-white text-ink shadow-sm")}
              aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
              aria-expanded={panelOpen}
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
              {unread > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#C0563E] ring-2 ring-cream" />
              )}
            </button>

            {panelOpen && (
              <div className="absolute right-0 top-[calc(100%+10px)] w-[min(360px,calc(100vw-2rem))] animate-scale-in overflow-hidden rounded-2xl border border-line bg-white shadow-float">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <div>
                    <p className="text-[12.5px] font-bold text-ink">Notifications</p>
                    <p className="text-[10px] text-muted">{unread} non lue{unread > 1 ? "s" : ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead().catch(() => undefined)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-sage transition hover:bg-sage-soft"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Tout lire
                  </button>
                </div>
                <div className="max-h-[330px] overflow-y-auto">
                  {scopedNotifications.map((notification) => {
                    const Icon = notificationIcons[notification.type];
                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(notification.id);
                          setPanelOpen(false);
                          const ticketId = notification.href.match(/^\/tickets\/([^/?#]+)/)?.[1];
                          const propertyId = allTickets.find((ticket) => ticket.id === ticketId)?.propertyId;
                          if (propertyId) setActiveProperty(propertyId);
                          router.push(notification.href);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 border-b border-line/70 px-4 py-3 text-left transition hover:bg-cream-soft",
                          !notification.read && "bg-sage-soft/30",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                            notification.type === "message"
                              ? "bg-sky text-sky-dark"
                              : notification.type === "document"
                                ? "bg-peach-soft text-peach-dark"
                                : "bg-sage-soft text-sage",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span className="flex-1 text-[11.5px] font-bold leading-snug text-ink">
                              {notification.title}
                            </span>
                            {!notification.read && (
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C0563E]" />
                            )}
                          </span>
                          <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                            {notification.detail}
                          </span>
                          <span className="mt-1 block text-[9px] font-medium text-muted/80">
                            {notification.time}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {scopedNotifications.length === 0 && <p className="px-4 py-6 text-center text-[10px] text-muted">Aucune notification pour le logement actif.</p>}
                <Link
                  href="/notifications"
                  onClick={() => setPanelOpen(false)}
                  className="flex items-center justify-center gap-1.5 py-2.5 text-[10.5px] font-semibold text-petrol transition hover:bg-cream-soft"
                >
                  Voir tout le journal
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          <Link href="/parametres" aria-label="Mon profil" className="flex items-center gap-2 rounded-full ring-offset-2 focus-visible:ring-2">
            <Avatar initials={user?.name.split(" ").map(n => n[0]).slice(0,2).join("") || "?"} size="sm" ring />
            <span className="hidden max-w-[120px] truncate text-[10px] font-semibold text-ink xl:block">{user?.name}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
