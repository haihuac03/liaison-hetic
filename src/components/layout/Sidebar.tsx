"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Building2,
  FileText,
  HelpCircle,
  Home,
  MessageSquare,
  Settings,
  Ticket,
  Users,
  Wallet,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLiaison } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Brand from "@/components/ui/Brand";
import RoleBadge from "./RoleBadge";
import { useProperty } from "@/lib/property";

function navigationForRole(role: "owner" | "tenant") {
  return [
    { name: "Tableau de bord", href: "/", icon: Home },
    { name: "Dossiers", href: "/tickets", icon: Ticket },
    { name: "Conversations", href: "/conversations", icon: MessageSquare },
    { name: role === "owner" ? "Baux" : "Bail", href: "/contrat", icon: FileText },
    { name: role === "owner" ? "Loyers" : "Loyer", href: "/loyer", icon: Wallet },
    { name: "Assistant IA", href: "/assistant", icon: Bot },
    { name: "Interlocuteurs", href: "/contacts", icon: Users },
  ];
}

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, properties, logout } = useAuth();
  const { activeProperty, scopedTickets } = useProperty();
  const [logoutError, setLogoutError] = useState("");
  const role = user?.role ?? "tenant";
  const navigation = navigationForRole(role);
  const openTickets = scopedTickets.filter(
    (t) => !["resolu", "ferme"].includes(t.status),
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-7 pt-6">
        <Link href="/" onClick={onNavigate} aria-label="LIAISON — Tableau de bord">
          <Brand />
        </Link>
        <div className="mt-3"><RoleBadge role={role} /></div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {navigation.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-[42px] items-center gap-3 rounded-[11px] px-3.5 text-[12.5px] font-semibold transition-all",
                active
                  ? "bg-petrol text-white shadow-[0_8px_18px_-12px_rgba(36,59,71,0.7)]"
                  : "text-[#4F585A] hover:bg-white/70 hover:text-petrol",
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-white" : "text-[#5F696B] group-hover:text-petrol",
                )}
                strokeWidth={1.9}
              />
              <span className="truncate">{item.name}</span>
              {item.href === "/tickets" && openTickets > 0 && (
                <span
                  className={cn(
                    "ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold",
                    active ? "bg-white/15 text-white" : "bg-white text-petrol",
                  )}
                >
                  {openTickets}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-4 px-3 pb-4 pt-8">
        <nav className="flex flex-col gap-0.5">
          {[
            ...(role === "owner" ? [{ name: "Portefeuille", href: "/bailleur", icon: Building2 }] : []),
            { name: role === "owner" || properties.length > 1 ? "Mes logements" : "Mon logement", href: "/logements", icon: Building2 },
            { name: "Paramètres", href: "/parametres", icon: Settings },
            { name: "Centre d'aide", href: "/aide", icon: HelpCircle },
          ].map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[38px] items-center gap-3 rounded-[10px] px-3.5 text-[12px] font-semibold transition",
                  active
                    ? "bg-white text-petrol shadow-sm"
                    : "text-[#626B6D] hover:bg-white/70 hover:text-petrol",
                )}
              >
                <item.icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/parametres"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-[13px] border border-white bg-white/85 p-2.5 shadow-soft transition hover:shadow-lift"
        >
          <Avatar initials={user?.name.split(" ").map(n => n[0]).slice(0,2).join("") || "?"} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-bold leading-tight text-ink">
              {user?.name}
            </p>
            <p className="mt-0.5 truncate text-[9px] font-medium text-muted">{activeProperty?.address || "Aucun logement actif"}</p>
          </div>
        </Link>
        <button onClick={() => logout().catch(e => setLogoutError(e.message))} className="flex items-center gap-2 px-3 text-xs font-semibold text-muted"><LogOut size={15}/> Se déconnecter</button>
        {logoutError && <p role="alert" className="px-3 text-xs text-red-700">{logoutError}</p>}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useUI();
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      const trigger = triggerRef.current;
      window.requestAnimationFrame(() => trigger?.focus());
    };
  }, [mobileNavOpen, setMobileNavOpen]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[264px] border-r border-[#E5E4DD] bg-[#F0EFEA] lg:block">
        <SidebarContent />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-petrol-dark/30 backdrop-blur-[2px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside ref={panelRef} role="dialog" aria-modal="true" aria-label="Navigation principale" className="relative h-full w-[286px] overflow-y-auto animate-slide-left border-r border-line bg-[#F0EFEA] shadow-float">
            <button
              ref={closeRef}
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-3 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-muted shadow-sm"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
