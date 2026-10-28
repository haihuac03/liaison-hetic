"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  Database,
  Download,
  Globe2,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  Phone,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth";
import { useCoreAuth } from "@/lib/client/core";
import { useProperty } from "@/lib/property";
import { useLiaison } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { cn, downloadText } from "@/lib/utils";

type Tab = "profil" | "notifications" | "donnees";

const TABS: { key: Tab; label: string; icon: typeof UserRound }[] = [
  { key: "profil", label: "Profil & logement", icon: UserRound },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "donnees", label: "Données & confidentialité", icon: Database },
];

const NOTIFICATION_SETTINGS = [
  { id: "messages", label: "Nouveaux messages", detail: "Messages liés à vos dossiers et documents", default: true },
  { id: "tickets", label: "Mises à jour de dossiers", detail: "Changement de statut, validation, clôture", default: true },
  { id: "interventions", label: "Interventions & rendez-vous", detail: "Confirmation, rappel J-1, compte-rendu", default: true },
  { id: "documents", label: "Nouveaux documents", detail: "Quittances, devis, accords et constats", default: true },
  { id: "weekly", label: "Résumé hebdomadaire", detail: "Chaque lundi, l'état de votre logement", default: false },
  { id: "product", label: "Nouveautés LIAISON", detail: "Conseils et évolutions du produit", default: false },
];

const settingsStorageKey = (userId?: string, propertyId?: string | null) => userId ? `liaison-settings-v6:${userId}:${propertyId || "none"}` : "";

const DEFAULT_PROFILE = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
};

const DEFAULT_NOTIFICATIONS: Record<string, boolean> = Object.fromEntries(
  NOTIFICATION_SETTINGS.map((item) => [item.id, item.default]),
);

const DEFAULT_CHANNELS = { email: true, push: true, sms: false };

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-sage" : "bg-[#DCDBD4]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { tickets, documents } = useLiaison();
  const { user } = useAuth();
  const { activeProperty } = useProperty();
  const { core } = useCoreAuth();
  const activeLease = core?.leases?.find((lease) => lease.property_id === activeProperty?.id && lease.status === "active");
  const roleLabel = user?.role === "owner" ? "Propriétaire" : "Locataire";
  const settingsKey = settingsStorageKey(user?.id, activeProperty?.id);
  const displayName = user?.name || "Votre compte";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const { showToast } = useUI();
  const [tab, setTab] = useState<Tab>("profil");
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [notifications, setNotifications] =
    useState<Record<string, boolean>>(DEFAULT_NOTIFICATIONS);
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    const parts = user.name.trim().split(/\s+/);
    setProfile((current) => ({
      ...current,
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" "),
      email: user.email,
      address: activeProperty?.address || "",
    }));
  }, [activeProperty?.address, user]);

  useEffect(() => {
    try {
      if (!settingsKey) return;
      const raw = window.localStorage.getItem(settingsKey);
      if (raw) {
        const saved = JSON.parse(raw) as {
          profile?: Partial<typeof DEFAULT_PROFILE>;
          notifications?: Record<string, boolean>;
          channels?: Partial<typeof DEFAULT_CHANNELS>;
        };
        if (saved.profile) setProfile((prev) => ({ ...prev, ...saved.profile }));
        if (saved.notifications)
          setNotifications((prev) => ({ ...prev, ...saved.notifications }));
        if (saved.channels) setChannels((prev) => ({ ...prev, ...saved.channels }));
      }
    } catch {
      // Keep demo defaults when the local settings cannot be read.
    }
    setSettingsReady(true);
  }, [settingsKey]);

  useEffect(() => {
    if (!settingsReady) return;
    try {
      if (settingsKey) window.localStorage.setItem(
        settingsKey,
        JSON.stringify({ profile, notifications, channels }),
      );
    } catch {
      // Preferences remain available for this session if storage is full.
    }
  }, [channels, notifications, profile, settingsKey, settingsReady]);

  const saveProfile = () => {
    showToast("Profil mis à jour", "Vos informations de contact ont été enregistrées sur cet appareil.");
  };

  const saveNotifications = () => {
    showToast("Préférences enregistrées", "Vous pouvez les modifier à tout moment.");
  };

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { ...profile, role: user?.role },
      property: activeProperty,
      lease: activeLease ?? null,
      tickets,
      documents,
      leases: core?.leases?.filter((lease) => lease.property_id === activeProperty?.id) ?? [],
      rentPeriods: core?.rent_periods?.filter((period) => (core?.leases || []).some((lease) => lease.id === period.lease_id && lease.property_id === activeProperty?.id)) ?? [],
      propertyDocuments: core?.property_documents?.filter((document) => document.property_id === activeProperty?.id) ?? [],
      notifications: core?.notifications ?? [],
    };
    downloadText("LIAISON_export_logement_actif.json", JSON.stringify(payload, null, 2));
    showToast("Export préparé", "Les données disponibles du logement actif ont été téléchargées.");
  };

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Votre compte
              <span className="text-muted/50">·</span>
              <span className="font-medium normal-case tracking-normal text-muted">
                Bail {activeLease ? activeLease.id.slice(0, 8) : "Non renseigné"}
              </span>
            </p>
            <h1 className="mt-1.5 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">
              Paramètres
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">
              Consultez votre compte, le logement actif et vos préférences de notification.
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-sage/20 bg-sage-soft px-3 py-2 text-[9px] font-semibold text-sage-dark">
            <BadgeCheck className="h-3.5 w-3.5" />
            Compte connecté
          </span>
        </header>

        <div className="mt-5 grid items-start gap-3.5 xl:grid-cols-[250px_minmax(0,1fr)_290px]">
          <aside className="card p-2.5 xl:sticky xl:top-[92px]">
            <div className="flex items-center gap-2.5 rounded-xl bg-cream-soft p-3">
              <Avatar initials={initials} size="md" online />
              <div className="min-w-0">
                <p className="truncate text-[10.5px] font-bold text-ink">{displayName}</p>
                <p className="truncate text-[8.5px] text-muted">{roleLabel} · {activeProperty?.address || "Aucun logement actif"}</p>
              </div>
            </div>
            <nav className="mt-1.5 flex flex-col gap-0.5">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-[9.5px] font-semibold transition",
                    tab === item.key ? "bg-petrol text-white" : "text-muted hover:bg-cream-soft hover:text-ink",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                  {tab === item.key && <ChevronRight className="ml-auto h-3 w-3 text-white/60" />}
                </button>
              ))}
            </nav>

            <div className="mt-2 border-t border-line px-2.5 pb-1 pt-2.5">
              <p className="text-[7.5px] font-bold uppercase tracking-[0.1em] text-muted">Aide</p>
              <Link
                href="/aide"
                className="mt-1 flex items-center gap-1.5 text-[8.5px] font-semibold text-sage hover:underline"
              >
                Centre d&apos;aide
                <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </aside>

          <div className="min-w-0">
            {tab === "profil" && (
              <div className="flex flex-col gap-3.5">
                <section className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar initials={initials} size="xl" />
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sage text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      </div>
                      <div>
                        <h2 className="font-headline text-[17px] font-bold tracking-[-0.02em] text-ink">{displayName}</h2>
                        <p className="mt-0.5 text-[9px] text-muted">{roleLabel} · {activeProperty?.address || "Aucun logement actif"}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5"><span className="chip bg-sage-light text-sage-dark">Compte connecté</span>{activeLease && <span className="chip bg-sky text-sky-dark">Bail enregistré</span>}</div>
                      </div>
                    </div>

                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      { key: "firstName", label: "Prénom", icon: UserRound },
                      { key: "lastName", label: "Nom", icon: UserRound },
                      { key: "email", label: "Adresse e-mail", icon: Mail },
                      { key: "phone", label: "Téléphone", icon: Phone },
                    ].map((field) => (
                      <label key={field.key} className="block">
                        <span className="flex items-center gap-1.5 text-[8.5px] font-bold text-ink">
                          <field.icon className="h-3 w-3 text-muted" />
                          {field.label}
                        </span>
                        <input
                          value={profile[field.key as keyof typeof profile]}
                          readOnly
                          className="field mt-1 h-9 bg-cream-soft text-[10px]"
                        />
                      </label>
                    ))}
                  </div>


                  <p className="mt-4 border-t border-line pt-3 text-[8px] text-muted">Les informations du compte sont en lecture seule. Le téléphone enregistré localement reste propre à cet appareil.</p>
                </section>

                <section className="card p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-soft text-petrol">
                      <Building2 className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <h2 className="text-[12px] font-bold text-ink">Mon logement</h2>
                      <p className="text-[8.5px] text-muted">Informations du bail</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["Logement", activeProperty ? "Logement partagé" : "Non renseigné"],
                      ["Adresse", activeProperty?.address || "Non renseigné"],
                      ["Propriétaire", activeProperty?.owner_name || "Non renseigné"],
                      ["Locataire", activeProperty?.tenant_name || "Non renseigné"],
                      ["Loyer", activeLease ? `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format((activeLease.rent_cents + activeLease.charges_cents) / 100)} / mois` : "Non renseigné"],
                      ["Dépôt de garantie", activeLease ? `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(activeLease.deposit_cents / 100)}` : "Non renseigné"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-cream-soft px-3 py-2.5">
                        <p className="text-[7.5px] font-semibold uppercase tracking-wide text-muted">{label}</p>
                        <p className="mt-0.5 text-[9.5px] font-semibold leading-snug text-ink">{value}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/contrat"
                    className="mt-3 flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line bg-white text-[8.5px] font-semibold text-ink transition hover:bg-cream-soft"
                  >
                    <ShieldCheck className="h-3 w-3" />
                    Consulter mon bail
                  </Link>
                </section>
              </div>
            )}

            {tab === "notifications" && (
              <div className="flex flex-col gap-3.5">
                <section className="card p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach-soft text-peach-dark">
                      <Bell className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <h2 className="text-[12px] font-bold text-ink">Choisir mes alertes</h2>
                      <p className="text-[8.5px] text-muted">Vous décidez de ce qui mérite votre attention.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {NOTIFICATION_SETTINGS.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[9.5px] font-bold text-ink">{item.label}</p>
                          <p className="text-[8px] text-muted">{item.detail}</p>
                        </div>
                        <Toggle
                          checked={notifications[item.id]}
                          onChange={(value) =>
                            setNotifications((prev) => ({ ...prev, [item.id]: value }))
                          }
                          label={item.label}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="card p-5">
                  <h2 className="text-[12px] font-bold text-ink">Canaux de réception</h2>
                  <p className="mt-0.5 text-[8.5px] text-muted">
                    Choisissez comment LIAISON vous prévient.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[
                      { key: "email", label: "E-mail", detail: user?.email || "Non renseigné", icon: Mail },
                      { key: "push", label: "Notification push", detail: "Application mobile", icon: Bell },
                      { key: "sms", label: "SMS", detail: profile.phone || "Non renseigné", icon: Smartphone },
                    ].map((channel) => (
                      <button
                        key={channel.key}
                        type="button"
                        onClick={() =>
                          setChannels((prev) => ({ ...prev, [channel.key]: !prev[channel.key as keyof typeof prev] }))
                        }
                        className={cn(
                          "rounded-xl border p-3 text-left transition",
                          channels[channel.key as keyof typeof channels]
                            ? "border-sage/30 bg-sage-soft/50"
                            : "border-line bg-cream-soft/40",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <channel.icon className="h-4 w-4 text-sage" />
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded-full border",
                              channels[channel.key as keyof typeof channels]
                                ? "border-sage bg-sage text-white"
                                : "border-line bg-white",
                            )}
                          >
                            {channels[channel.key as keyof typeof channels] && <Check className="h-2.5 w-2.5" />}
                          </span>
                        </div>
                        <p className="mt-2 text-[9px] font-bold text-ink">{channel.label}</p>
                        <p className="mt-0.5 truncate text-[7.5px] text-muted">{channel.detail}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <p className="text-[8px] text-muted">Les alertes critiques restent toujours actives.</p>
                    <button type="button" onClick={saveNotifications} className="btn-dark h-9 px-4 text-[9.5px]">
                      <Check className="h-3.5 w-3.5" />
                      Enregistrer
                    </button>
                  </div>
                </section>
              </div>
            )}

            {tab === "donnees" && (
              <div className="flex flex-col gap-3.5">
                <section className="card p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-soft text-sky-dark">
                      <Database className="h-3.5 w-3.5" />
                    </span>
                    <div>
                      <h2 className="text-[12px] font-bold text-ink">Mes données</h2>
                      <p className="text-[8.5px] text-muted">Vous gardez la propriété de vos informations.</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={exportData}
                      className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2.5 text-left transition hover:bg-cream-soft"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-soft text-petrol">
                        <Download className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9.5px] font-bold text-ink">Exporter mes données</span>
                        <span className="block text-[8px] text-muted">
                          {tickets.length} dossiers · {documents.length} documents · format JSON
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted/40" />
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast("Préférences de confidentialité", "Aucun partenaire n'a accès à vos données.", "info")}
                      className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2.5 text-left transition hover:bg-cream-soft"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-soft text-petrol">
                        <Globe2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9.5px] font-bold text-ink">Confidentialité & partage</span>
                        <span className="block text-[8px] text-muted">
                          Accès limité aux parties du bail et intervenants autorisés
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted/40" />
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast("Politique de conservation", "Aucune purge automatique n’est configurée. Les données restent dans la base locale du serveur.", "info")}
                      className="flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2.5 text-left transition hover:bg-cream-soft"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream-soft text-petrol">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[9.5px] font-bold text-ink">Conservation des archives</span>
                        <span className="block text-[8px] text-muted">
                          Aucune purge automatique configurée
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted/40" />
                    </button>
                  </div>
                </section>



              </div>
            )}
          </div>

          <aside className="flex flex-col gap-3">
            <section className="relative overflow-hidden rounded-card bg-petrol p-4 text-white shadow-soft">
              <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/[0.04]" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-mint">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[7.5px] font-bold uppercase tracking-[0.14em] text-white/55">
                      Votre espace
                    </p>
                    <h2 className="text-[11.5px] font-bold">{roleLabel}</h2>
                  </div>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[8.5px]">
                  {[
                    ["Bail", activeLease ? activeLease.id.slice(0, 8) : "Non renseigné"],
                    ["Loyer", activeLease ? `${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format((activeLease.rent_cents + activeLease.charges_cents) / 100)} / mois` : "Non renseigné"],
                    ["Propriétaire", activeProperty?.owner_name || "Non renseigné"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-white/50">{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={user?.role === "owner" ? "/bailleur" : "/logements"}
                  className="mt-3 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white/10 text-[8.5px] font-semibold text-white transition hover:bg-white/15"
                >
                  <Building2 className="h-3 w-3" />
                  {user?.role === "owner" ? "Voir le portefeuille" : "Voir mes logements"}
                  <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </div>
            </section>

            <section className="card p-4">
              <h2 className="text-[10.5px] font-bold text-ink">Besoin d&apos;aide ?</h2>
              <p className="mt-1 text-[8.5px] leading-relaxed text-muted">
                Consultez les réponses fonctionnelles ou échangez avec l’autre partie dans un dossier.
              </p>
              <Link
                href="/aide"
                className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-lg bg-sage-soft text-[8.5px] font-semibold text-sage-dark transition hover:bg-sage-light"
              >
                <MessageSquare className="h-3 w-3" />
                Voir le centre d’aide
              </Link>
            </section>

            <section className="card p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-sage" />
                <p className="text-[8.5px] font-bold text-ink">Sécurité LIAISON</p>
              </div>
              <p className="mt-1.5 text-[8px] leading-relaxed text-muted">
                Connexion par session authentifiée. Les données applicatives sont stockées dans la base locale du serveur.
              </p>
            </section>
          </aside>
        </div>
      </div>

    </AppShell>
  );
}
