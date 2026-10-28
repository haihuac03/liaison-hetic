"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Download,
  Lock,
  Paperclip,
  Send,
  Share2,
  X,
} from "lucide-react";
import { useLiaison } from "@/lib/store";
import { useUI } from "@/lib/ui";
import type { Attachment, Ticket } from "@/lib/types";
import { cn, downloadText, fileKind, readFileAsDataUrl } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import MessageBubble from "./MessageBubble";

export default function Chat({
  ticket,
  draft = "",
  onDraftConsumed,
}: {
  ticket: Ticket;
  draft?: string;
  onDraftConsumed?: () => void;
}) {
  const { tickets, sendMessage } = useLiaison();
  const { showToast } = useUI();
  const current = tickets.find((item) => item.id === ticket.id) ?? ticket;
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const typing = false;
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const closed = current.status === "ferme" || current.status === "resolu";

  useEffect(() => {
    if (draft) {
      setText(draft);
      onDraftConsumed?.();
      inputRef.current?.focus();
    }
  }, [draft, onDraftConsumed]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [current.messages.length, typing]);

  const addFiles = async (files: File[], kind: "image" | "file") => {
    const next: Attachment[] = [];
    for (const file of files.slice(0, 4 - pending.length)) {
      if (file.size === 0 || file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
        showToast("Fichier non accepté", "Formats : JPG, PNG, WebP, PDF ; 10 Mo maximum.", "warning");
        return;
      }
      if (kind === "image") {
        const src = await readFileAsDataUrl(file);
        next.push({ src, alt: file.name, kind: "image", name: file.name });
      } else {
        const actualKind = fileKind(file.name);
        next.push({
          src: await readFileAsDataUrl(file),
          alt: file.name,
          kind: actualKind === "image" ? "image" : "file",
          name: file.name,
        });
      }
    }
    setPending((prev) => [...prev, ...next].slice(0, 4));
  };

  const send = async () => {
    if (closed || sending) return;
    const clean = text.trim();
    if (!clean && pending.length === 0) return;
    setSending(true);
    try {
      await sendMessage(current.id, clean || "Pièce jointe transmise.", pending);
      setText("");
      setPending([]);
    } catch (cause) {
      showToast("Envoi impossible", cause instanceof Error ? cause.message : "Réessayez.", "warning");
    } finally { setSending(false); }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Lien du dossier copié", "Partagez-le avec une partie prenante de confiance.");
    } catch {
      showToast("Lien du dossier", window.location.href, "info");
    }
  };

  const exportThread = () => {
    const content = [
      `LIAISON — Dossier #${current.id}`,
      current.title,
      "",
      ...current.messages.map(
        (message) => `[${message.time}] ${message.authorName} : ${message.text}`,
      ),
      "",
      "Export local des messages enregistrés dans le dossier.",
    ].join("\n");
    downloadText(`LIAISON_ticket_${current.id}.txt`, content);
    showToast("Conversation exportée", "Le journal horodaté a été téléchargé.");
  };

  return (
    <>
      <section
        id="chat"
        className="card flex h-[min(620px,70vh)] min-h-[380px] scroll-mt-28 flex-col overflow-hidden"
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-line/80 px-4 py-3">
          <Avatar initials={current.assignee.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate font-headline text-[13px] font-bold text-ink">{current.assignee}</h2>
              <span className="chip bg-cream-soft text-[#5F686B]">{current.correspondentRole || "Bailleur"}</span>
            </div>
            <p className="mt-0.5 text-[8.5px] text-muted">{current.address || "Conversation du dossier"}</p>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="icon-btn h-8 w-8 rounded-lg"
            aria-label="Partager la conversation"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={exportThread}
            className="icon-btn h-8 w-8 rounded-lg"
            aria-label="Télécharger la conversation"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#FAF9F5] px-3.5 py-4">
          <div className="flex justify-center">
            <span className="rounded-full border border-line/70 bg-white/90 px-3 py-1 text-[8px] font-medium text-muted shadow-sm">
              {current.createdAt}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-3">
            {current.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onImageClick={(src, alt) => setLightbox({ src, alt })}
              />
            ))}

            {typing && (
              <div className="flex items-center gap-2 pl-9">
                <span className="text-[8.5px] font-medium text-muted">Votre interlocuteur écrit</span>
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1 w-1 animate-bounce rounded-full bg-muted"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line/80 bg-white">
          <div className="flex items-center justify-center gap-1.5 px-3 pb-1.5 pt-2">
            <Lock className="h-2.5 w-2.5 text-muted/70" />
            <p className="text-center text-[7.5px] leading-tight text-muted/80">
              Les messages ajoutés sont enregistrés dans ce dossier.
            </p>
          </div>

          {closed ? (
            <div className="px-3 pb-3">
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-cream-soft px-3 py-2.5 text-[9px] font-medium text-muted">
                <Lock className="h-3 w-3" />
                Dossier fermé — les échanges restent consultables.
              </div>
            </div>
          ) : (
            <div className="px-3 pb-3">
              {pending.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {pending.map((attachment) => (
                    <span
                      key={`${attachment.name}-${attachment.src.slice(-10)}`}
                      className="flex items-center gap-1.5 rounded-lg border border-line bg-cream-soft px-2 py-1 text-[8px] font-medium text-ink"
                    >
                      {attachment.kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachment.src} alt="" className="h-5 w-5 rounded object-cover" />
                      ) : (
                        <Paperclip className="h-2.5 w-2.5 text-muted" />
                      )}
                      <span className="max-w-[130px] truncate">{attachment.name}</span>
                      <button
                        type="button"
                        aria-label="Retirer la pièce jointe"
                        onClick={() =>
                          setPending((prev) =>
                            prev.filter((item) => item.src !== attachment.src || item.name !== attachment.name),
                          )
                        }
                        className="text-muted hover:text-danger"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-1.5 rounded-xl border border-line bg-white p-1.5 shadow-[0_1px_2px_rgba(28,39,44,0.03)] focus-within:border-petrol/25 focus-within:ring-4 focus-within:ring-petrol/5">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder="Écrire un message…"
                  className="max-h-24 min-h-[34px] flex-1 resize-none bg-transparent px-1.5 py-2 text-[10px] leading-relaxed text-ink outline-none placeholder:text-muted/70"
                />
                <div className="flex shrink-0 items-center gap-0.5 pb-0.5">
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-cream-soft hover:text-ink"
                    aria-label="Ajouter une photo"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => docRef.current?.click()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-cream-soft hover:text-ink"
                    aria-label="Ajouter un document"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={send}
                    disabled={sending}
                    className="ml-1 flex h-8 w-8 items-center justify-center rounded-[9px] bg-petrol text-white transition hover:bg-petrol-dark"
                    aria-label="Envoyer le message"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <input
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length) addFiles(files, "image");
                  event.target.value = "";
                }}
              />
              <input
                ref={docRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length) addFiles(files, "file");
                  event.target.value = "";
                }}
              />
            </div>
          )}
        </div>
      </section>

      <Modal
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        className="max-w-3xl bg-transparent shadow-none"
        ariaLabel="Aperçu de la pièce jointe"
      >
        {lightbox && (
          <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              className="max-h-[78vh] w-full rounded-xl bg-cream-soft object-contain"
            />
            <p className="px-2 py-2 text-center text-[9.5px] font-medium text-muted">{lightbox.alt}</p>
          </div>
        )}
      </Modal>
    </>
  );
}
