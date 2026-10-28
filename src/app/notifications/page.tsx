"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  CheckCheck,
  FileText,
  MessageSquare,
  Settings,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLiaison } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useProperty } from "@/lib/property";
import type { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type NotificationFilter = "toutes" | "unread" | "messages" | "dossiers";

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: "toutes", label: "Toutes" },
  { id: "unread", label: "Non lues" },
  { id: "messages", label: "Messages" },
  { id: "dossiers", label: "Dossiers" },
];

const ICONS = {
  message: MessageSquare,
  ticket: Ticket,
  document: FileText,
  system: ShieldCheck,
};

const TONES = {
  message: "bg-sky-soft text-sky-dark",
  ticket: "bg-sage-soft text-sage",
  document: "bg-peach-soft text-peach-dark",
  system: "bg-cream-soft text-petrol",
};

function matchFilter(notification: NotificationItem, filter: NotificationFilter) {
  if (filter === "toutes") return true;
  if (filter === "unread") return !notification.read;
  if (filter === "messages") return notification.type === "message";
  if (filter === "dossiers") return notification.type === "ticket";
  return notification.type === "ticket";
}

export default function NotificationsPage() {
  const { notifications: allNotifications, markNotificationRead, markAllNotificationsRead } = useLiaison();
  const { activeProperty, scopedTickets } = useProperty();
  const { showToast } = useUI();
  const [filter, setFilter] = useState<NotificationFilter>("toutes");

  const notifications = useMemo(() => {
    const ticketIds = new Set(scopedTickets.map((ticket) => ticket.id));
    return allNotifications.filter((notification) => {
      const match = notification.href.match(/^\/tickets\/([^/?#]+)/);
      return Boolean(match && ticketIds.has(match[1]));
    });
  }, [allNotifications, scopedTickets]);
  const filtered = useMemo(
    () => notifications.filter((notification) => matchFilter(notification, filter)),
    [filter, notifications],
  );

  const unread = notifications.filter((notification) => !notification.read).length;
  const linkedTickets = new Set(
    notifications
      .map((notification) => notification.href)
      .filter((href) => href.startsWith("/tickets/")),
  ).size;

  const stats = [
    {
      label: "Non lues",
      value: String(unread).padStart(2, "0"),
      helper: "À traiter",
      icon: Bell,
      tone: "bg-peach-soft text-peach-dark",
    },
    {
      label: "Journal",
      value: String(notifications.length).padStart(2, "0"),
      helper: "Depuis votre entrée",
      icon: CheckCheck,
      tone: "bg-sage-soft text-sage",
    },
    {
      label: "Dossiers concernés",
      value: String(linkedTickets).padStart(2, "0"),
      helper: "Tickets liés",
      icon: Ticket,
      tone: "bg-sky-soft text-sky-dark",
    },
  ];

  const markAll = async () => {
    if (unread === 0) {
      showToast("Aucune notification non lue", "Votre journal est déjà à jour.", "info");
      return;
    }
    try {
      await markAllNotificationsRead(notifications.map((notification) => notification.id));
      showToast("Journal à jour", "Toutes les notifications du logement sont marquées comme lues.");
    } catch (cause) {
      showToast("Mise à jour impossible", cause instanceof Error ? cause.message : "Réessayez.", "warning");
    }
  };

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Journal d&apos;activité
              <span className="text-muted/50">·</span>
              <span className="font-medium normal-case tracking-normal text-muted">
                {unread} non lue{unread > 1 ? "s" : ""}
              </span>
            </p>
            <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
              Notifications
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Décisions, interventions, documents et accords : le journal de{" "}
              {activeProperty?.address || "votre logement actif"}.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link href="/parametres" className="btn-soft h-10">
              <Settings className="h-4 w-4 text-sage" />
              Préférences
            </Link>
            <button type="button" onClick={markAll} className="btn-dark h-10">
              <CheckCheck className="h-4 w-4" />
              Tout marquer lu
            </button>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card flex items-start gap-3 p-3.5">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  stat.tone,
                )}
              >
                <stat.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-muted">
                  {stat.label}
                </p>
                <p className="mt-0.5 font-headline text-[24px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                  {stat.value}
                </p>
                <p className="mt-1 text-[8.5px] text-muted">{stat.helper}</p>
              </div>
            </div>
          ))}
          <div className="card flex items-start gap-3 p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage text-white">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.08em] text-muted">
                Canal partagé
              </p>
              <p className="mt-0.5 font-headline text-[19px] font-extrabold leading-none tracking-[-0.03em] text-ink">
                Archivé
              </p>
              <p className="mt-1 text-[8.5px] text-muted">Horodatage conservé</p>
            </div>
          </div>
        </div>

        <div className="no-scrollbar mt-4 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((item) => {
            const count = notifications.filter((notification) =>
              matchFilter(notification, item.id),
            ).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-[9.5px] font-semibold transition",
                  filter === item.id
                    ? "bg-petrol text-white shadow-[0_6px_14px_-10px_rgba(36,59,71,0.7)]"
                    : "border border-line bg-white/70 text-muted hover:border-petrol/20 hover:text-ink",
                )}
              >
                {item.label}
                <span className={cn("text-[8px]", filter === item.id ? "text-white/55" : "text-muted/60")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <section className="card mt-3 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cream-soft text-muted">
                <Bell className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-headline text-[16px] font-bold text-ink">
                Aucune notification
              </h2>
              <p className="mt-1 max-w-xs text-[10.5px] leading-relaxed text-muted">
                {filter === "unread"
                  ? "Vous êtes à jour : toutes les notifications ont été lues."
                  : "Aucun élément ne correspond à ce filtre pour le moment."}
              </p>
              {filter !== "toutes" && (
                <button
                  type="button"
                  onClick={() => setFilter("toutes")}
                  className="btn-soft mt-3 h-8 px-3.5 text-[9.5px]"
                >
                  Voir tout le journal
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {filtered.map((notification) => {
                const Icon = ICONS[notification.type];
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex flex-wrap items-start gap-3 px-4 py-3.5 transition sm:flex-nowrap",
                      !notification.read && "bg-sage-soft/25",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                        TONES[notification.type],
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-2">
                        <p className="min-w-0 flex-1 text-[11.5px] font-bold leading-snug text-ink">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="mt-1 flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[7.5px] font-bold uppercase tracking-wide text-[#B3543F] shadow-sm">
                            <span className="h-1 w-1 rounded-full bg-[#C0563E]" />
                            Nouveau
                          </span>
                        )}
                        <span className="text-[8.5px] font-medium text-muted">
                          {notification.time}
                        </span>
                      </div>
                      {notification.detail && <p className="mt-1 text-[9.5px] leading-relaxed text-muted">{notification.detail}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Link
                          href={notification.href}
                          onClick={() => markNotificationRead(notification.id)}
                          className="flex h-7 items-center gap-1 rounded-lg bg-cream-soft px-2.5 text-[8.5px] font-bold text-ink transition hover:bg-petrol hover:text-white"
                        >
                          Ouvrir
                          <ArrowUpRight className="h-2.5 w-2.5" />
                        </Link>
                        {!notification.read ? (
                          <button
                            type="button"
                            onClick={() => {
                              markNotificationRead(notification.id);
                              showToast(
                                "Notification lue",
                                "Elle reste disponible dans votre journal.",
                                "info",
                              );
                            }}
                            className="text-[8px] font-semibold text-muted transition hover:text-sage"
                          >
                            Marquer comme lue
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-[8px] font-medium text-muted/70">
                            <CheckCheck className="h-2.5 w-2.5 text-sage" />
                            Lue
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 bg-cream-soft/50 px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-[8.5px] font-medium text-muted">
              <ShieldCheck className="h-3 w-3 text-sage" />
              Journal du logement · conservé dans votre espace
            </p>
            <Link
              href="/parametres"
              className="flex items-center gap-1 text-[8.5px] font-semibold text-muted transition hover:text-sage"
            >
              Choisir mes alertes
              <Settings className="h-2.5 w-2.5" />
            </Link>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-white/45 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[9px] font-medium text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            {notifications.length} événements consignés · {unread} à traiter · données lues depuis votre espace
          </p>
          <Link
            href="/parametres"
            className="flex items-center gap-1 text-[9px] font-semibold text-muted transition hover:text-sage"
          >
            Gérer mes notifications
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
