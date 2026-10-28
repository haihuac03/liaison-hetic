"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileText, MapPin, MessageSquare, RotateCcw, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import TicketTimeline from "@/components/tickets/TicketTimeline";
import ClosureWorkflow from "@/components/tickets/ClosureWorkflow";
import InterventionWorkflow from "@/components/tickets/InterventionWorkflow";
import DisputeWorkflow from "@/components/tickets/DisputeWorkflow";
import CloseAgreementModal from "@/components/tickets/CloseAgreementModal";
import TicketDocuments from "@/components/tickets/TicketDocuments";
import Chat from "@/components/chat/Chat";
import AssistantIA from "@/components/assistant/AssistantIA";
import DocumentPreviewModal from "@/components/documents/DocumentPreviewModal";
import { type PreviewDoc } from "@/components/documents/DocumentCard";
import TicketStatus from "@/components/ui/TicketStatus";
import Modal from "@/components/ui/Modal";
import { CATEGORY_META, STATUS_META } from "@/lib/meta";
import { coreRequest, useCoreAuth } from "@/lib/client/core";
import { useLiaison } from "@/lib/store";
import { ticketAttention, useProperty } from "@/lib/property";
import { useUI } from "@/lib/ui";
import { cn } from "@/lib/utils";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { tickets, updateStatus, hydrated } = useLiaison();
  const { core, refresh, loading: coreLoading, error: coreError } = useCoreAuth();
  const { activePropertyId, setActiveProperty } = useProperty();
  const { showToast } = useUI();
  const [closeOpen, setCloseOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [draft, setDraft] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [reopening, setReopening] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const ticket = tickets.find((item) => item.id === id);

  useEffect(() => {
    if (ticket?.propertyId && ticket.propertyId !== activePropertyId) {
      setActiveProperty(ticket.propertyId);
    }
  }, [activePropertyId, setActiveProperty, ticket?.propertyId]);

  if (!ticket && (!hydrated || coreLoading)) {
    return <AppShell><div className="mx-auto mt-10 max-w-md animate-fade-up"><div className="card flex items-center justify-center gap-3 p-8 text-[11px] font-medium text-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-petrol/20 border-t-petrol" />Chargement du dossier…</div></div></AppShell>;
  }

  if (!ticket && coreError) {
    return <AppShell><div className="mx-auto mt-10 max-w-md animate-fade-up"><div className="card p-8 text-center"><h1 className="font-headline text-[20px] font-bold text-ink">Dossier indisponible</h1><p className="mt-1 text-[11px] leading-relaxed text-muted">{coreError}</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={() => void refresh()} className="btn-dark h-9 px-4 text-[10.5px]">Réessayer</button><Link href="/tickets" className="btn-soft h-9 px-4 text-[10.5px]">Mes tickets</Link></div></div></div></AppShell>;
  }

  if (!ticket) {
    return <AppShell><div className="mx-auto mt-10 max-w-md animate-fade-up text-center"><div className="card p-8"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream-soft text-muted"><FileText className="h-5 w-5" /></span><h1 className="mt-3 font-headline text-[20px] font-bold text-ink">Dossier introuvable</h1><p className="mt-1 text-[11px] leading-relaxed text-muted">Ce ticket n’est pas disponible pour ce compte.</p><Link href="/tickets" className="btn-dark mt-4 h-9 px-4 text-[10.5px]"><ArrowLeft className="h-3.5 w-3.5" />Revenir aux tickets</Link></div></div></AppShell>;
  }

  const status = STATUS_META[ticket.status] || STATUS_META.ouvert;
  const attention = ticketAttention(ticket, core?.user.id, core?.user.role);
  const category = CATEGORY_META[ticket.category];
  const CategoryIcon = category.icon;
  const closed = ticket.status === "ferme" || ticket.status === "resolu";
  const pendingClosureRequest = (core?.closures || []).find((item) => item.ticket_id === ticket.id && item.status === "pending");
  const pendingClosure = Boolean(pendingClosureRequest);
  const canModifyClosure = Boolean(pendingClosureRequest && pendingClosureRequest.requester_id === core?.user.id);
  const workflowLocked = ["en_litige", "en_cloture"].includes(ticket.status) || pendingClosure || (core?.interventions || []).some((item) => item.ticket_id === ticket.id && ["proposed", "accepted", "awaiting_confirmation", "contested"].includes(item.status)) || (core?.disputes || []).some((item) => item.ticket_id === ticket.id && item.status === "open");
  const insertMessage = (text: string) => { setDraft(text); window.setTimeout(() => document.getElementById("chat")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80); };

  const reopen = async () => {
    if (!reopenReason.trim()) { setReopenError("Indiquez le motif de réouverture."); return; }
    setReopening(true); setReopenError("");
    try {
      await coreRequest("reopen", { ticketId: ticket.id, reason: reopenReason.trim() });
      await refresh();
      setReopenOpen(false); setReopenReason("");
      showToast("Dossier réouvert", "Les deux parties peuvent à nouveau participer au dossier.");
    } catch (cause) {
      setReopenError(cause instanceof Error ? cause.message : "La réouverture a échoué.");
    } finally { setReopening(false); }
  };

  const changeStatus = async (next: "en_cours" | "en_attente") => {
    setStatusBusy(true);
    try {
      await updateStatus(ticket.id, next);
      showToast("Statut mis à jour", `Le dossier est désormais « ${STATUS_META[next].label} ».`);
    } catch (cause) {
      showToast("Statut non modifié", cause instanceof Error ? cause.message : "Réessayez.", "warning");
    } finally { setStatusBusy(false); }
  };

  return (
    <AppShell>
      <div className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-2 text-[9.5px] font-medium text-muted"><Link href="/tickets" className="flex items-center gap-1.5 transition hover:text-petrol"><ArrowLeft className="h-3 w-3" />Dossiers</Link><ChevronRight className="h-3 w-3 text-muted/50" /><span className="font-semibold text-ink">Dossier #{ticket.id.slice(0, 8)}</span><span className="text-muted/50">·</span><span>{ticket.address || "Logement actif"}</span></div>

        <header className="mt-2.5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-md bg-petrol px-2 py-1 text-[9px] font-bold tracking-wide text-white">#{ticket.id.slice(0, 8)}</span><TicketStatus status={ticket.status} /><span className={cn("chip", attention.owner === "you" ? "bg-peach text-peach-dark" : attention.owner === "other" ? "bg-sky text-sky-dark" : "bg-cream-soft text-muted")}>{attention.label}</span><span className="chip bg-cream-soft text-[#5F686B]"><CategoryIcon className="h-2.5 w-2.5" />{category.label}</span>{closed && <span className="chip bg-cream-dark text-[#60696B]">Lecture seule</span>}</div><h1 className="mt-2 font-headline text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-ink sm:text-[28px]">{ticket.title}</h1><p className="mt-1.5 max-w-3xl whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted">{ticket.description}</p><p className={cn("mt-2 text-[10px] font-semibold", attention.owner === "you" ? "text-peach-dark" : "text-muted")}>{attention.detail}</p></div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">{closed ? <button type="button" onClick={() => { setReopenOpen(true); setReopenError(""); }} className="btn-soft h-10"><RotateCcw className="h-4 w-4" />Réouvrir le dossier</button> : <><div className={cn("flex h-10 items-center gap-1 rounded-xl border border-line bg-white p-1 shadow-soft", (statusBusy || workflowLocked) && "pointer-events-none opacity-50")} title={workflowLocked ? "Le statut est verrouillé pendant une action en cours." : undefined}><button type="button" disabled={statusBusy || workflowLocked} onClick={() => void changeStatus("en_cours")} className={cn("h-8 rounded-lg px-2.5 text-[9px] font-semibold transition", ticket.status === "en_cours" ? "bg-petrol text-white" : "text-muted hover:bg-cream-soft hover:text-ink")}>En cours</button><button type="button" disabled={statusBusy || workflowLocked} onClick={() => void changeStatus("en_attente")} className={cn("h-8 rounded-lg px-2.5 text-[9px] font-semibold transition", ticket.status === "en_attente" ? "bg-petrol text-white" : "text-muted hover:bg-cream-soft hover:text-ink")}>En attente</button></div>{!pendingClosure && <button type="button" onClick={() => setCloseOpen(true)} className="btn-sage h-10 px-4 text-[11.5px]"><CheckCircle2 className="h-4 w-4" />Demander la clôture</button>}{canModifyClosure && <button type="button" onClick={() => setCloseOpen(true)} className="btn-soft h-10 px-3.5 text-[10.5px]">Modifier ma demande</button>}{pendingClosure && !canModifyClosure && <span className="chip bg-sky text-sky-dark">Clôture à confirmer</span>}</>}</div>
        </header>

        <div className="mt-4 grid items-start gap-3.5 xl:grid-cols-[270px_minmax(0,1fr)_288px]">
          <div className="order-2 flex flex-col gap-3 xl:order-1">
            <TicketTimeline ticket={ticket} />
            <section className="card p-3.5"><p className="eyebrow">Dossier</p><div className="mt-2 space-y-2"><Info icon={CalendarDays} label="Créé le" value={ticket.createdAt} /><Info icon={Clock3} label="Dernière activité" value={ticket.updatedAt} /><Info icon={MapPin} label="Logement" value={ticket.address || "Non renseigné"} /><Info icon={UserRound} label="Contact" value={`${ticket.assignee} · ${ticket.correspondentRole || "autre partie"}`} /></div></section>
            <section className="card p-3.5"><p className="eyebrow">Participants</p><div className="mt-2 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-petrol-soft text-petrol"><MessageSquare className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-[10.5px] font-bold text-ink">{ticket.assignee}</p><p className="text-[8.5px] text-muted">{ticket.correspondentRole || "Interlocuteur"}</p></div></div></section>
          </div>

          <div className="order-1 flex min-w-0 flex-col gap-3 xl:order-2">
            <ClosureWorkflow ticket={ticket} onCreate={() => setCloseOpen(true)} />
            <InterventionWorkflow ticket={ticket} />
            <DisputeWorkflow ticket={ticket} />
            <Chat ticket={ticket} draft={draft} onDraftConsumed={() => setDraft("")} />
          </div>

          <div className="order-3 flex flex-col gap-3">
            {!closed && <AssistantIA ticket={ticket} onInsertMessage={insertMessage} />}
            <TicketDocuments ticket={ticket} onPreview={setPreview} />
            <section className="rounded-card border border-line bg-white p-3.5 shadow-soft"><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted">État du dossier</p><p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-ink">{status.description}</p><p className="mt-2 text-[8.5px] leading-relaxed text-muted">{closed ? "Les actions sont désactivées. Le motif de réouverture permet de reprendre le dossier." : pendingClosure ? "Une décision sur la clôture est attendue avant les autres modifications." : "Les propositions et décisions sont enregistrées dans l’historique."}</p></section>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line/70 bg-white/45 px-4 py-3"><p className="text-[9px] font-medium text-muted">Dossier #{ticket.id.slice(0, 8)} · {status.label.toLowerCase()} · {ticket.messages.length} message{ticket.messages.length > 1 ? "s" : ""}</p><Link href="/aide" className="flex items-center gap-1 text-[9px] font-semibold text-muted hover:text-sage">Aide sur ce dossier<ChevronRight className="h-3 w-3" /></Link></div>
      </div>

      <CloseAgreementModal ticket={ticket} open={closeOpen} onClose={() => setCloseOpen(false)} />
      <DocumentPreviewModal document={preview} open={Boolean(preview)} onClose={() => setPreview(null)} />
      <Modal open={reopenOpen} onClose={() => !reopening && setReopenOpen(false)} className="max-w-[520px]" ariaLabel="Réouvrir le dossier"><div className="p-5 sm:p-6"><h2 className="font-headline text-[16px] font-bold text-ink">Réouvrir le dossier</h2><p className="mt-1 text-[9px] leading-relaxed text-muted">Expliquez pourquoi de nouvelles actions sont nécessaires.</p><label className="mt-3 block text-[9px] font-bold text-ink">Motif <span className="text-danger">*</span><textarea value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} rows={3} className="field mt-1 resize-none py-2 text-[10px]" /></label>{reopenError && <p className="mt-2 rounded-lg bg-peach-soft px-3 py-2 text-[9px] text-peach-dark">{reopenError}</p>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setReopenOpen(false)} disabled={reopening} className="btn-soft h-9 px-3.5 text-[10px]">Annuler</button><button type="button" onClick={() => void reopen()} disabled={reopening} className="btn-dark h-9 px-4 text-[10px] disabled:opacity-60">{reopening ? "Réouverture…" : "Réouvrir"}</button></div></div></Modal>
      <Modal open={Boolean(lightbox)} onClose={() => setLightbox(null)} className="max-w-3xl bg-transparent shadow-none" ariaLabel="Aperçu de la photo">{lightbox && <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-float"><img src={lightbox} alt="Photo du dossier" className="max-h-[78vh] w-full rounded-xl bg-cream-soft object-contain" /></div>}</Modal>
    </AppShell>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="flex items-start gap-2"><Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted" /><div className="min-w-0"><p className="text-[7.5px] font-bold uppercase tracking-wide text-muted">{label}</p><p className="mt-0.5 text-[9px] font-semibold leading-snug text-ink">{value}</p></div></div>;
}
