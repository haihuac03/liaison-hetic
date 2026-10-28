"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, FileStack, FileText, FolderOpen, Grid2X2, ImageIcon, LayoutList, Search, Upload } from "lucide-react";
import AppShell from "@/components/AppShell";
import RoleBadge from "@/components/layout/RoleBadge";
import DocumentCard, { type PreviewDoc } from "@/components/documents/DocumentCard";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";
import { useAuth } from "@/lib/auth";
import { useCoreAuth } from "@/lib/client/core";
import { useProperty } from "@/lib/property";
import type { DocumentItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: DocumentItem["category"][] = ["Bail", "États des lieux", "Quittances", "Devis", "Factures", "Accords", "Constats", "Photos"];

function categoryFor(name: string, mime: string): DocumentItem["category"] {
  const value = name.toLowerCase();
  if (/quittance|reçu|recu/.test(value)) return "Quittances";
  if (/bail|contrat/.test(value)) return "Bail";
  if (/état des lieux|etat des lieux|edl/.test(value)) return "États des lieux";
  if (/devis/.test(value)) return "Devis";
  if (/facture/.test(value)) return "Factures";
  if (/accord|convention/.test(value)) return "Accords";
  if (mime.startsWith("image/")) return "Photos";
  return "Constats";
}

function formattedDate(value: number) {
  return value ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "Date inconnue";
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const { core, loading, error, refresh } = useCoreAuth();
  const { activeProperty } = useProperty();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | DocumentItem["category"]>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const documents = useMemo<DocumentItem[]>(() => {
    if (!core || !activeProperty) return [];
    const ticketIds = new Set(core.tickets.filter((ticket) => ticket.property_id === activeProperty.id).map((ticket) => ticket.id));
    const ticketDocuments = core.files.filter((file) => ticketIds.has(file.ticket_id)).map((file) => ({
      id: `ticket-${file.id}`,
      name: file.name,
      category: categoryFor(file.name, file.mime),
      size: `${Math.max(1, Math.ceil(file.size / 1024))} Ko`,
      date: file.created_at ? formattedDate(file.created_at) : "Date inconnue",
      preview: `/api/core/file/${file.id}`,
      type: file.mime.startsWith("image/") ? "image" as const : "pdf" as const,
      ticketId: file.ticket_id,
      description: `Pièce du ticket ${file.ticket_id.slice(0, 8)}`,
    }));
    const leaseDocuments = (core.property_documents || []).filter((document) => document.property_id === activeProperty.id).map((document) => ({
      id: `property-${document.id}`,
      name: document.name,
      category: categoryFor(document.name, document.mime),
      size: `${Math.max(1, Math.ceil(document.size / 1024))} Ko`,
      date: formattedDate(document.created_at),
      preview: `/api/core/lease-file/${document.id}`,
      type: document.mime.startsWith("image/") ? "image" as const : "pdf" as const,
      description: "Pièce rattachée au logement",
    }));
    return [...leaseDocuments, ...ticketDocuments];
  }, [activeProperty, core]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (category !== "all" && document.category !== category) return false;
      return !q || `${document.name} ${document.category} ${document.description}`.toLowerCase().includes(q);
    });
  }, [category, documents, query]);
  const counts = useMemo(() => documents.reduce((map, document) => map.set(document.category, (map.get(document.category) || 0) + 1), new Map<DocumentItem["category"], number>()), [documents]);
  const linkedTickets = useMemo(() => (core?.tickets || []).filter((ticket) => ticket.property_id === activeProperty?.id && documents.some((document) => document.ticketId === ticket.id)), [activeProperty?.id, core?.tickets, documents]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("doc");
    if (!requested || !documents.length) return;
    const match = documents.find((document) => document.id === requested || document.id === `ticket-${requested}` || document.id === `property-${requested}`);
    if (match) setPreview(match);
  }, [documents]);

  const upload = async (files: File[]) => {
    if (!activeProperty || !files.length) return;
    setUploadError("");
    const selected = files.slice(0, 5);
    if (selected.some((file) => file.size === 0 || file.size > 10 * 1024 * 1024)) {
      setUploadError("Chaque fichier doit peser entre 1 octet et 10 Mo.");
      return;
    }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type))) {
      setUploadError("Formats acceptés : JPG, PNG, WebP et PDF.");
      return;
    }
    setBusy(true);
    try {
      const lease = core?.leases?.find((item) => item.property_id === activeProperty.id && item.status === "active");
      const form = new FormData();
      form.set("propertyId", activeProperty.id);
      if (lease) form.set("leaseId", lease.id);
      for (const file of selected) form.append("files", file, file.name);
      const response = await fetch("/api/core/lease-upload", { method: "POST", credentials: "same-origin", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "L’envoi des documents a échoué.");
      await refresh();
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "L’envoi des documents a échoué.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <AppShell><p className="p-8 text-center text-sm text-muted">Chargement des documents…</p></AppShell>;

  return (
    <AppShell>
      <div className="animate-fade-up">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><RoleBadge role={user?.role || "tenant"} /><h1 className="mt-2 font-headline text-[30px] font-extrabold tracking-[-0.04em] text-ink sm:text-[34px]">Documents</h1><p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted">Les pièces réellement enregistrées pour {activeProperty?.address || "le logement actif"}.</p></div>
          <div className="flex gap-2"><input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => { void upload(Array.from(event.target.files || [])); event.target.value = ""; }} /><button type="button" disabled={!activeProperty || busy} onClick={() => fileRef.current?.click()} className="btn-dark h-10 disabled:opacity-50"><Upload className="h-4 w-4" />{busy ? "Envoi…" : "Ajouter des pièces"}</button></div>
        </header>
        {(uploadError || error) && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError || error}</p>}
        {!activeProperty && <section className="card mt-5 p-6 text-sm text-muted">Sélectionnez un logement actif pour afficher ses documents.</section>}

        <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[{ label: "Documents", value: documents.length, detail: "Logement actif", icon: FileStack }, { label: "Photos", value: counts.get("Photos") || 0, detail: "Images consultables", icon: ImageIcon }, { label: "Pièces du logement", value: documents.filter((document) => document.id.startsWith("property-")).length, detail: "Déposées pour ce logement", icon: FolderOpen }, { label: "Tickets liés", value: linkedTickets.length, detail: "Documents issus de tickets", icon: FileText }].map((stat) => <div key={stat.label} className="card flex items-center gap-3 p-3.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cream-soft text-petrol"><stat.icon className="h-[18px] w-[18px]" /></span><div><p className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">{stat.label}</p><p className="mt-0.5 font-headline text-[19px] font-extrabold text-ink">{stat.value}</p><p className="mt-0.5 text-[8px] text-muted">{stat.detail}</p></div></div>)}
        </div>

        <section className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-line bg-cream-soft px-3"><Search className="h-4 w-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un document…" className="min-w-0 flex-1 bg-transparent text-[10.5px] outline-none" /></div><div className="flex h-10 items-center rounded-xl border border-line bg-white p-1"><button onClick={() => setView("grid")} className={cn("flex h-7 w-7 items-center justify-center rounded-lg", view === "grid" ? "bg-cream-soft text-ink" : "text-muted")} aria-label="Vue grille"><Grid2X2 className="h-3.5 w-3.5" /></button><button onClick={() => setView("list")} className={cn("flex h-7 w-7 items-center justify-center rounded-lg", view === "list" ? "bg-cream-soft text-ink" : "text-muted")} aria-label="Vue liste"><LayoutList className="h-3.5 w-3.5" /></button></div></section>

        <div className="mt-3 flex flex-wrap gap-1.5"><button onClick={() => setCategory("all")} className={cn("chip", category === "all" ? "bg-petrol text-white" : "bg-white text-muted")}>Tous · {documents.length}</button>{CATEGORY_ORDER.filter((item) => counts.get(item)).map((item) => <button key={item} onClick={() => setCategory(item)} className={cn("chip", category === item ? "bg-petrol text-white" : "bg-white text-muted")}>{item} · {counts.get(item)}</button>)}</div>

        <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div>{filtered.length === 0 ? <div className="card px-6 py-16 text-center"><FileText className="mx-auto h-6 w-6 text-muted" /><h2 className="mt-3 font-headline text-[16px] font-bold">Aucun document</h2><p className="mt-1 text-[10px] text-muted">Ajoutez une pièce ou modifiez les filtres.</p></div> : view === "grid" ? <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((document) => <DocumentCard key={document.id} document={document} variant="grid" onPreview={setPreview} />)}</div> : <div className="card overflow-hidden">{filtered.map((document) => <div key={document.id} className="border-b border-line/60 p-2.5 last:border-0"><DocumentCard document={document} onPreview={setPreview} /></div>)}</div>}</div>
          <aside className="flex flex-col gap-3"><section className="card p-4"><h2 className="text-[11px] font-bold text-ink">Tickets contenant des pièces</h2><div className="mt-2 flex flex-col gap-1">{linkedTickets.map((ticket) => <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream-soft"><span className="rounded bg-petrol px-1.5 py-0.5 text-[7px] font-bold text-white">#{ticket.id.slice(0, 8)}</span><span className="min-w-0 flex-1 truncate text-[8.5px] font-semibold">{ticket.title}</span><span className="text-[7.5px] text-muted">{documents.filter((document) => document.ticketId === ticket.id).length}</span></Link>)}{!linkedTickets.length && <p className="rounded-lg bg-cream-soft p-3 text-[9px] text-muted">Aucun ticket ne contient encore de pièce.</p>}</div></section><section className="card p-4"><h2 className="text-[11px] font-bold text-ink">Formats et accès</h2><p className="mt-2 text-[9px] leading-relaxed text-muted">JPG, PNG, WebP et PDF jusqu’à 10 Mo. Les fichiers sont visibles uniquement par les parties de ce logement.</p><button onClick={() => fileRef.current?.click()} className="btn-soft mt-3 h-9 w-full text-[9px]"><Upload className="h-3.5 w-3.5" />Ajouter un document</button></section></aside>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-white/45 px-4 py-3"><p className="text-[9px] text-muted">{documents.length} document{documents.length > 1 ? "s" : ""} pour {activeProperty?.address || "aucun logement"}</p><button onClick={() => void refresh()} className="flex items-center gap-1 text-[9px] font-semibold text-sage"><Download className="h-3 w-3" />Actualiser</button></div>
      </div>
      <DocumentPreviewModal document={preview} open={Boolean(preview)} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
