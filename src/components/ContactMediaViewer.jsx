import React from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { cloudinaryUrl } from "../utils/cloudinary";
import LazyImage from "./ui/LazyImage";
import LazyVideo from "./ui/LazyVideo";
import { formatLongDate } from "../utils/formatters";
import { safeHttpUrl } from "../utils/safeUrl";

export default function ContactMediaViewer({
  viewer,
  viewerItem,
  targetName,
  closeButtonRef,
  onClose,
  onChange,
  onShowMessage,
}) {
  const source = safeHttpUrl(viewerItem.src);
  const original = safeHttpUrl(viewerItem.original);
  return <>
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button ref={closeButtonRef} type="button" className="icon-btn text-white focus-visible:ring-2 focus-visible:ring-white" aria-label="Close viewer" onClick={onClose}><X size={20} /></button>
        <span className="min-w-0 flex-1 truncate text-sm">{viewerItem.message.senderName || targetName} · {formatLongDate(viewerItem.message.date, { month: "short", day: "numeric", year: "numeric" })}</span>
        <span className="text-xs tabular-nums">{viewer.index + 1} / {viewer.items.length}</span>
        {original && <a href={original} target="_blank" rel="noopener noreferrer" className="icon-btn text-white" aria-label="Open original media"><Download size={18} /></a>}
        <button type="button" onClick={() => onShowMessage(viewerItem.message.id)} className="rounded-full border border-white/30 px-3 py-2 text-xs font-semibold">Show in chat</button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <button type="button" onClick={() => onChange((current) => ({ ...current, index: (current.index - 1 + current.items.length) % current.items.length }))} className="absolute left-2 z-10 icon-btn text-white" aria-label="Previous media"><ChevronLeft size={26} /></button>
        {viewerItem.kind === "video"
          ? <LazyVideo src={source || ""} startOnMount className="max-h-full max-w-full" />
          : <LazyImage src={cloudinaryUrl(source || "", { w: 1600, q: "auto", fmt: "auto" })} alt="Shared media" width={viewerItem.message.width} height={viewerItem.message.height} priority objectFit="contain" className="max-h-full max-w-full" />}
        {viewerItem.kind !== "video" && viewer.items.length > 1 && <img src={cloudinaryUrl(viewer.items[(viewer.index + 1) % viewer.items.length].src, { w: 1600, q: "auto", fmt: "auto" })} alt="" className="hidden" />}
        {viewer.items.length > 1 && <button type="button" onClick={() => onChange((current) => ({ ...current, index: (current.index + 1) % current.items.length }))} className="absolute right-2 z-10 icon-btn text-white" aria-label="Next media"><ChevronRight size={26} /></button>}
      </div>
  </>;
}
