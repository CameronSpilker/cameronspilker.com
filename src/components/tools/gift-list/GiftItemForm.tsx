"use client";

import { useState } from "react";
import { giftListTool as copy } from "@/content/tools";
import { LIMITS } from "@/lib/gifts/input";
import { parsePrice, priceInputValue } from "@/lib/gifts/price";
import { storeName } from "@/lib/gifts/stores";
import type { GiftItemInput } from "@/lib/gifts/types";
import { GiftThumb, buttons } from "./parts";

type Mode = "one" | "several" | "unlimited";

function modeFor(quantity: number | null): Mode {
  if (quantity === null) return "unlimited";
  return quantity > 1 ? "several" : "one";
}

/**
 * Adding and editing share one form. It opens already filled from a pasted
 * link, so the usual path is a glance and one press.
 */
export function GiftItemForm({
  initial,
  submitLabel,
  busy,
  error,
  notice,
  onSubmit,
  onCancel,
}: {
  initial: GiftItemInput;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  notice?: string | null;
  onSubmit: (item: GiftItemInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [url, setUrl] = useState(initial.url ?? "");
  const [price, setPrice] = useState(priceInputValue(initial.priceCents));
  const [imageUrl, setImageUrl] = useState(initial.imageUrl ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [mode, setMode] = useState<Mode>(modeFor(initial.quantity));
  const [count, setCount] = useState(initial.quantity && initial.quantity > 1 ? initial.quantity : 2);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || busy) return;
    const link = url.trim() || null;
    onSubmit({
      title: title.trim(),
      url: link,
      imageUrl: imageUrl.trim() || null,
      priceCents: parsePrice(price),
      store: link ? storeName(link) : null,
      note: note.trim() || null,
      quantity: mode === "unlimited" ? null : mode === "one" ? 1 : Math.min(Math.max(count, 2), LIMITS.quantity),
    });
  };

  const modes: { id: Mode; label: string }[] = [
    { id: "one", label: copy.form.one },
    { id: "several", label: copy.form.several },
    { id: "unlimited", label: copy.form.unlimited },
  ];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {notice && <p className="rounded-2xl bg-raised px-4 py-2.5 text-sm text-bright">{notice}</p>}

      <div className="flex gap-4">
        <GiftThumb src={imageUrl.trim() || null} className="h-24 w-24 sm:h-28 sm:w-28" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={buttons.label}>{copy.form.title}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.itemTitle}
              placeholder={copy.form.titlePlaceholder}
              required
              autoFocus={!initial.title}
              className={buttons.input}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={buttons.label}>{copy.form.price}</span>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-body">$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder={copy.form.pricePlaceholder}
                className={`${buttons.input} pl-8`}
              />
            </div>
          </label>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={buttons.label}>{copy.form.link}</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          inputMode="url"
          maxLength={LIMITS.url}
          placeholder={copy.form.linkPlaceholder}
          className={buttons.input}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={buttons.label}>{copy.form.image}</span>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          type="url"
          inputMode="url"
          maxLength={LIMITS.url}
          placeholder={copy.form.imagePlaceholder}
          className={buttons.input}
        />
        {!imageUrl.trim() && <span className="text-xs leading-relaxed text-body/80">{copy.form.imageHint}</span>}
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${buttons.label} mb-1.5`}>{copy.form.quantity}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-line bg-surface/60 p-1">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  mode === m.id ? "bg-accent text-surface" : "text-body hover:text-bright"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {mode === "several" && (
            <div className="inline-flex items-center rounded-full border border-line bg-surface/60">
              <button type="button" aria-label={copy.form.fewer} onClick={() => setCount((c) => Math.max(2, c - 1))} className="h-9 w-9 text-lg text-bright">
                −
              </button>
              <span className="w-8 text-center font-mono text-sm text-bright" aria-live="polite">
                {count}
              </span>
              <button
                type="button"
                aria-label={copy.form.more}
                onClick={() => setCount((c) => Math.min(LIMITS.quantity, c + 1))}
                className="h-9 w-9 text-lg text-bright"
              >
                +
              </button>
            </div>
          )}
        </div>
        {mode === "unlimited" && <span className="text-xs text-body/80">{copy.form.unlimitedHint}</span>}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className={buttons.label}>{copy.form.note}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={LIMITS.itemNote}
          rows={2}
          placeholder={copy.form.notePlaceholder}
          className={`${buttons.input} resize-none`}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-[var(--viz-critical)]">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttons.secondary}>
          {copy.form.cancel}
        </button>
        <button type="submit" disabled={!title.trim() || busy} className={buttons.primary}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
