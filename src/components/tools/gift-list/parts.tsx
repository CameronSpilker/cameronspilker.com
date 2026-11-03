"use client";

import { useState } from "react";

/**
 * The product picture, straight from the store's own image server. No referrer
 * is sent, which is both kinder to the guest and what gets past the hotlink
 * checks some shops run. A picture that fails to load becomes the gift glyph.
 */
export function GiftThumb({
  src,
  alt = "",
  className = "",
  muted = false,
}: {
  src: string | null;
  alt?: string;
  className?: string;
  muted?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = src && failed !== src;
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white ${className}`}
    >
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote shop images with unknown hosts
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(src)}
          className={`h-full w-full object-contain p-1.5 transition ${muted ? "opacity-50 grayscale" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-raised">
          <GiftIcon className={`h-1/3 w-1/3 text-accent ${muted ? "opacity-40" : "opacity-70"}`} />
        </div>
      )}
    </div>
  );
}

export function GiftIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  );
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function GripIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {[6, 12, 18].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.6" />
          <circle cx="15" cy={y} r="1.6" />
        </g>
      ))}
    </svg>
  );
}

export function ArrowOutIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

/** The site's two button weights, so every screen of the tool matches. */
export const buttons = {
  primary:
    "wheel-cta inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-2 text-sm font-semibold text-bright transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50",
  quiet:
    "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-body transition-colors hover:bg-bright/5 hover:text-bright disabled:opacity-40",
  input:
    "w-full min-w-0 rounded-2xl border border-line bg-surface/70 px-4 py-2.5 text-base text-bright placeholder:text-body/60 focus:border-accent focus:outline-none sm:text-sm",
  label: "text-xs font-semibold text-body",
};

/** Copies to the clipboard and says so for a moment. */
export function CopyButton({ text, label, done, className }: { text: string; label: string; done: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className ?? buttons.secondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt(label, text);
        }
      }}
    >
      {copied ? (
        <>
          <CheckIcon className="h-4 w-4" />
          {done}
        </>
      ) : (
        label
      )}
    </button>
  );
}
