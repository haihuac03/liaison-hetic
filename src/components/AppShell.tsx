"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useCoreAuth } from "@/lib/client/core";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./layout/Sidebar";
import Topbar from "./layout/Topbar";
import ToastViewport from "@/components/ui/ToastViewport";
import NewTicketModal from "@/components/tickets/NewTicketModal";
import SearchModal from "@/components/search/SearchModal";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, properties, loading, error, refresh } = useAuth();
  const coreSession = useCoreAuth();
  useEffect(() => { if (!loading && !user && !error) router.replace(`/auth?next=${encodeURIComponent(pathname)}`); }, [loading, user, error, pathname, router]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    const label = pathname === "/" ? "Tableau de bord" : pathname.startsWith("/tickets/") ? "Détail du dossier" : pathname.startsWith("/tickets") ? "Dossiers" : pathname.startsWith("/bailleur") ? "Portefeuille" : pathname.startsWith("/contrat") ? "Bail" : pathname.startsWith("/loyer") ? "Loyer" : pathname.startsWith("/documents") ? "Documents" : pathname.startsWith("/conversations") ? "Conversations" : pathname.startsWith("/notifications") ? "Notifications" : pathname.startsWith("/logements") ? "Logements" : pathname.startsWith("/parametres") ? "Paramètres" : pathname.startsWith("/aide") ? "Aide" : pathname.startsWith("/assistant") ? "Assistant" : pathname.startsWith("/contacts") ? "Contacts" : "LIAISON";
    document.title = `${label} · LIAISON`;
  }, [pathname]);

  if (loading || coreSession.loading || !user) return <div className="flex min-h-screen items-center justify-center bg-cream"><div className="card p-8 text-center"><p className="text-sm text-muted">{error || coreSession.error || "Chargement de votre espace…"}</p>{(error || coreSession.error) && <button onClick={() => { void refresh(); void coreSession.refresh(); }} className="btn-dark mt-4 h-10">Réessayer</button>}</div></div>;
  if (!coreSession.core) return <div className="flex min-h-screen items-center justify-center bg-cream"><div className="card p-8 text-center"><p className="text-sm text-muted">{coreSession.error || "Impossible de charger votre espace."}</p><button onClick={() => void coreSession.refresh()} className="btn-dark mt-4 h-10">Réessayer</button></div></div>;

  return (
    <div className="min-h-screen bg-cream">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-petrol focus:shadow-float">Aller au contenu principal</a>
      <Sidebar />
      <div className="lg:pl-[264px]">
        <Topbar />
        <main id="main-content" className="mx-auto min-h-screen w-full max-w-[1380px] px-4 pb-14 pt-[136px] sm:pt-[112px] lg:px-7 lg:pt-[112px]">
          {!properties.length && pathname !== "/logements" && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-5"><div><p className="text-sm font-bold text-petrol">Bienvenue {user.name.split(" ")[0]}</p><p className="mt-1 text-xs text-muted">{user.role === "owner" ? "Ajoutez votre logement pour inviter votre locataire." : "Rejoignez votre logement avec le code de votre propriétaire."}</p></div><Link href={user.role === "owner" ? "/logements" : "/invitation"} className="btn-dark h-10">{user.role === "owner" ? "Ajouter un logement" : "Saisir mon code"}</Link></div>}
          {children}
        </main>
      </div>
      <NewTicketModal />
      <SearchModal />
      <ToastViewport />
    </div>
  );
}
