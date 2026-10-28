"use client";

import { Bot, FileText, ShieldCheck } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";

export default function MessageBubble({
  message,
  onImageClick,
}: {
  message: ChatMessage;
  onImageClick: (src: string, alt: string) => void;
}) {
  if (message.system) {
    return (
      <div className="my-1.5 flex justify-center px-4">
        <div className="flex max-w-[90%] items-start gap-1.5 rounded-full border border-line/70 bg-white/80 px-3 py-1.5 text-center">
          <ShieldCheck className="mt-0.5 h-2.5 w-2.5 shrink-0 text-sage" />
          <p className="text-[8px] leading-relaxed text-muted">
            {message.text}
            <span className="ml-1 text-[7.5px] text-muted/60">{message.time}</span>
          </p>
        </div>
      </div>
    );
  }

  const isThomas = message.isOwn ?? message.author === "thomas";
  const isAssistant = message.author === "assistant";
  const authorAvatar =
    message.author === "thomas"
      ? { src: "/images/avatar-thomas.jpg", initials: "TM", tone: "petrol" as const }
      : message.author === "claire"
        ? { src: "/images/avatar-claire.jpg", initials: "CB", tone: "peach" as const }
        : message.author === "artisan"
          ? { src: "/images/avatar-artisan.jpg", initials: "PM", tone: "sage" as const }
          : { src: undefined, initials: "AH", tone: "sky" as const };

  const bubbleTone = isThomas
    ? "bg-[#F0EFEA] text-ink"
    : isAssistant
      ? "border border-sage/15 bg-sage-soft text-ink"
      : "border border-sage/10 bg-sage-soft text-ink";

  return (
    <div className={cn("flex gap-2", isThomas || isAssistant ? "flex-row" : "flex-row-reverse")}>
      {isAssistant ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-petrol text-white">
          <Bot className="h-3.5 w-3.5" />
        </span>
      ) : (
        <Avatar
          src={message.isOwn === undefined ? authorAvatar.src : undefined}
          initials={message.isOwn === undefined ? authorAvatar.initials : message.authorName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase()}
          tone={authorAvatar.tone}
          size="sm"
          className="mt-0.5"
        />
      )}

      <div className={cn("min-w-0 max-w-[88%]", !isThomas && !isAssistant && "items-end")}>
        <div
          className={cn(
            "mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5",
            !isThomas && !isAssistant && "justify-end",
          )}
        >
          <span className="text-[9px] font-bold text-ink">{message.authorName}</span>
          {message.role && (
            <span className="chip bg-white/80 px-1.5 py-0.5 text-[7.5px] text-muted">{message.role}</span>
          )}
          <span className="text-[7.5px] font-medium text-muted">{message.time}</span>
        </div>

        <div className={cn("rounded-[13px] px-3 py-2", bubbleTone, !isThomas && !isAssistant && "rounded-tr-[4px]", (isThomas || isAssistant) && "rounded-tl-[4px]")}>
          <p className="whitespace-pre-wrap text-[10.5px] leading-relaxed">{message.text}</p>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1">
              {message.attachments.map((attachment, index) =>
                attachment.kind === "file" ? (
                  <a
                    key={`${attachment.src}-${index}`}
                    href={attachment.src}
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-3 flex items-center gap-2 rounded-lg border border-line bg-white p-2 text-left"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-peach-soft text-[#B35C45]">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[8.5px] font-bold text-ink">
                        {attachment.name ?? "Document joint"}
                      </span>
                      <span className="text-[7.5px] text-muted">Document joint</span>
                    </span>
                  </a>
                ) : (
                  <button
                    key={`${attachment.src}-${index}`}
                    type="button"
                    onClick={() => onImageClick(attachment.src, attachment.alt)}
                    className="group relative aspect-square overflow-hidden rounded-md bg-cream-dark"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.src}
                      alt={attachment.alt}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <span className="absolute bottom-1 left-1 rounded bg-petrol/70 px-1 py-0.5 text-[6.5px] font-bold text-white backdrop-blur">
                      {index + 1}/{message.attachments?.length}
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
