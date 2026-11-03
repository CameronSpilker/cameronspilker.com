"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { giftListTool as copy } from "@/content/tools";
import { LIMITS } from "@/lib/gifts/input";
import { formatPrice } from "@/lib/gifts/price";
import type { GiftItem, GiftItemInput, GiftList } from "@/lib/gifts/types";
import { ApiError, api, editUrl, errorText, keyFor, rememberList, shareUrl } from "./client";
import { GiftItemForm } from "./GiftItemForm";
import { CopyButton, GiftThumb, GripIcon, buttons } from "./parts";

const EMPTY: GiftItemInput = {
  title: "",
  url: null,
  imageUrl: null,
  priceCents: null,
  store: null,
  note: null,
  quantity: 1,
};

function toInput(item: GiftItem): GiftItemInput {
  const { title, url, imageUrl, priceCents, store, note, quantity } = item;
  return { title, url, imageUrl, priceCents, store, note, quantity };
}

function looksLikeUrl(text: string) {
  return /^https?:\/\/\S+$/i.test(text.trim()) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/\S*$/i.test(text.trim());
}

function moved<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type Drag = { id: string; startY: number; startIndex: number; index: number; step: number; dy: number };

/** `/tools/gift-list/[slug]/edit`: the owner's side. Never shows claims. */
export function GiftListEditor({ slug }: { slug: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [list, setList] = useState<GiftList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lost, setLost] = useState(false);

  // Adding
  const [link, setLink] = useState("");
  const [fetching, setFetching] = useState(false);
  const [draft, setDraft] = useState<{ input: GiftItemInput; notice: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Editing one item
  const [editing, setEditing] = useState<string | null>(null);

  // Header details
  const [details, setDetails] = useState({ title: "", ownerName: "", note: "" });
  const [detailsState, setDetailsState] = useState<"idle" | "saving" | "saved">("idle");

  const [fresh, setFresh] = useState<"idle" | "busy" | "done">("idle");
  const [canShare, setCanShare] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());

  const load = useCallback(
    async (k: string) => {
      try {
        const data = await api.get(slug, k);
        setList(data);
        setDetails({ title: data.title, ownerName: data.ownerName, note: data.note });
        rememberList({ slug, key: k, title: data.title });
      } catch (e) {
        setLoadError(errorText(e));
      }
    },
    [slug],
  );

  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("key");
    const k = fromHash ?? keyFor(slug);
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL and storage after hydration */
    setCanShare(typeof navigator.share === "function");
    if (!k) {
      setLost(true);
      return;
    }
    setKey(k);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!fromHash) history.replaceState(null, "", `#key=${k}`);
    void load(k);
  }, [slug, load]);

  if (lost) {
    return <Notice text={copy.owner.lost} />;
  }
  if (loadError) {
    return <Notice text={loadError} />;
  }
  if (!list || !key) {
    return <div className="glass h-64 animate-pulse rounded-[28px]" aria-busy="true" />;
  }

  const items = list.items;
  const setItems = (next: GiftItem[]) => setList({ ...list, items: next });

  const startAdd = async (text: string) => {
    const value = text.trim();
    if (!value || fetching) return;
    setFormError(null);
    if (!looksLikeUrl(value)) {
      setDraft({ input: { ...EMPTY, title: value.slice(0, LIMITS.itemTitle) }, notice: null });
      setLink("");
      return;
    }
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    setFetching(true);
    try {
      const p = await api.preview(slug, key, url);
      const partial = !p.title || !p.imageUrl || p.priceCents === null;
      setDraft({
        input: { ...EMPTY, title: p.title ?? "", url: p.url, imageUrl: p.imageUrl, priceCents: p.priceCents, store: p.store },
        notice: partial ? copy.form.partial : null,
      });
    } catch (e) {
      setDraft({ input: { ...EMPTY, url }, notice: e instanceof ApiError && e.code === "bad_url" ? errorText(e) : copy.form.partial });
    } finally {
      setFetching(false);
      setLink("");
    }
  };

  const add = async (input: GiftItemInput) => {
    setSaving(true);
    setFormError(null);
    try {
      const { id } = await api.addItem(slug, key, input);
      setItems([...items, { id, ...input, claims: [] }]);
      setDraft(null);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const save = async (id: string, input: GiftItemInput) => {
    setSaving(true);
    setFormError(null);
    try {
      await api.updateItem(slug, key, id, input);
      setItems(items.map((item) => (item.id === id ? { ...item, ...input } : item)));
      setEditing(null);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: GiftItem) => {
    if (!window.confirm(copy.owner.removeConfirm)) return;
    setItems(items.filter((i) => i.id !== item.id));
    try {
      await api.deleteItem(slug, key, item.id);
    } catch {
      void load(key);
    }
  };

  const saveOrder = async (next: GiftItem[]) => {
    try {
      await api.update(slug, key, { order: next.map((i) => i.id) });
    } catch {
      void load(key);
    }
  };

  /* Drag to rank. Pointer events, so the same code serves a mouse and a thumb. */

  const onGripDown = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const index = items.findIndex((i) => i.id === id);
    const first = rows.current.get(items[0].id)?.getBoundingClientRect();
    const second = items[1] && rows.current.get(items[1].id)?.getBoundingClientRect();
    const step = first && second ? second.top - first.top : (first?.height ?? 80) + 8;
    setDrag({ id, startY: event.clientY, startIndex: index, index, step, dy: 0 });
  };

  const onGripMove = (event: React.PointerEvent) => {
    if (!drag) return;
    const dy = event.clientY - drag.startY;
    const target = Math.min(items.length - 1, Math.max(0, Math.round(drag.startIndex + dy / drag.step)));
    if (target !== drag.index) setItems(moved(items, drag.index, target));
    setDrag({ ...drag, index: target, dy });
  };

  const onGripUp = () => {
    if (!drag) return;
    if (drag.index !== drag.startIndex) void saveOrder(items);
    setDrag(null);
  };

  const onGripKey = (event: React.KeyboardEvent, index: number) => {
    const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : null;
    if (to === null || to < 0 || to >= items.length) return;
    event.preventDefault();
    const next = moved(items, index, to);
    setItems(next);
    void saveOrder(next);
    // Keep focus on the handle that moved, at its new place.
    const id = items[index].id;
    requestAnimationFrame(() => rows.current.get(id)?.querySelector<HTMLElement>("[data-grip]")?.focus());
  };

  const saveDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    setDetailsState("saving");
    try {
      await api.update(slug, key, details);
      setList({ ...list, ...details });
      rememberList({ slug, key, title: details.title });
      setDetailsState("saved");
      setTimeout(() => setDetailsState("idle"), 1600);
    } catch (e) {
      setDetailsState("idle");
      window.alert(errorText(e));
    }
  };

  const clearAll = async () => {
    if (!window.confirm(copy.owner.fresh.confirm)) return;
    setFresh("busy");
    try {
      await api.update(slug, key, { clearClaims: true });
      setFresh("done");
    } catch (e) {
      setFresh("idle");
      window.alert(errorText(e));
    }
  };

  const share = shareUrl(slug);
  const detailsChanged =
    details.title !== list.title || details.ownerName !== list.ownerName || details.note !== list.note;

  return (
    <div className="flex flex-col gap-6">
      {/* Title and sharing, first on every screen size: it is what the owner came to do. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight break-words text-bright sm:text-5xl">
            <span className="text-gradient">{list.title}</span>
          </h1>
          <p className="mt-2 font-mono text-xs text-body/80">{copy.owner.count(items.length)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canShare ? (
            <button
              type="button"
              className={buttons.primary}
              onClick={() => navigator.share({ title: list.title, url: share }).catch(() => {})}
            >
              {copy.owner.share}
            </button>
          ) : null}
          <CopyButton
            text={share}
            label={copy.owner.copy}
            done={copy.owner.copied}
            className={canShare ? buttons.secondary : buttons.primary}
          />
          <Link href={`/tools/gift-list/${slug}`} className={buttons.secondary}>
            {copy.owner.preview}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Add */}
          <section className="glass rounded-[28px] p-5 sm:p-6">
            {draft ? (
              <GiftItemForm
                key={draft.input.url ?? draft.input.title}
                initial={draft.input}
                notice={draft.notice}
                submitLabel={copy.form.add}
                busy={saving}
                error={formError}
                onSubmit={add}
                onCancel={() => setDraft(null)}
              />
            ) : (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void startAdd(link);
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (looksLikeUrl(text)) {
                        e.preventDefault();
                        void startAdd(text);
                      }
                    }}
                    disabled={fetching}
                    inputMode="url"
                    placeholder={fetching ? copy.owner.fetching : copy.owner.pastePlaceholder}
                    aria-label={copy.owner.pastePlaceholder}
                    className={`${buttons.input} flex-1 rounded-full`}
                  />
                  <button type="submit" disabled={fetching || !link.trim()} className={buttons.primary}>
                    {fetching ? <Spinner /> : copy.owner.fetch}
                  </button>
                </form>
                <div className="mt-2 flex items-center justify-between gap-3 pl-1">
                  <span className="text-xs text-body/80">{copy.owner.noLink}</span>
                  <button
                    type="button"
                    className={buttons.quiet}
                    onClick={() => setDraft({ input: EMPTY, notice: null })}
                  >
                    {copy.owner.manual}
                  </button>
                </div>
              </>
            )}
          </section>

          {/* The list, in rank order */}
          <section className="glass rounded-[28px] p-3 sm:p-4">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm">{copy.owner.empty}</p>
            ) : (
              <>
                <p className="px-3 pt-2 pb-3 text-xs text-body/80">{copy.owner.dragHint}</p>
                <ul className="flex flex-col gap-2">
                  {items.map((item, index) => {
                    const dragging = drag?.id === item.id;
                    const offset = dragging ? drag.dy - (drag.index - drag.startIndex) * drag.step : 0;
                    if (editing === item.id) {
                      return (
                        <li key={item.id} className="rounded-3xl border border-accent/40 bg-surface/80 p-4 sm:p-5">
                          <GiftItemForm
                            initial={toInput(item)}
                            submitLabel={copy.form.save}
                            busy={saving}
                            error={formError}
                            onSubmit={(input) => save(item.id, input)}
                            onCancel={() => setEditing(null)}
                          />
                        </li>
                      );
                    }
                    return (
                      <li
                        key={item.id}
                        ref={(el) => {
                          if (el) rows.current.set(item.id, el);
                          else rows.current.delete(item.id);
                        }}
                        style={dragging ? { transform: `translateY(${offset}px)` } : undefined}
                        className={`relative flex items-center gap-3 rounded-3xl border bg-surface/70 p-2.5 pr-3 sm:gap-4 ${
                          dragging ? "z-10 border-accent shadow-[0_18px_40px_var(--glass-shadow)]" : "border-line"
                        }`}
                      >
                        <button
                          type="button"
                          data-grip
                          aria-label={copy.owner.dragLabel(item.title)}
                          onPointerDown={(e) => onGripDown(e, item.id)}
                          onPointerMove={onGripMove}
                          onPointerUp={onGripUp}
                          onPointerCancel={onGripUp}
                          onKeyDown={(e) => onGripKey(e, index)}
                          className="flex h-12 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-body/60 hover:bg-bright/5 hover:text-bright active:cursor-grabbing"
                        >
                          <GripIcon className="h-5 w-5" />
                        </button>
                        <span className="w-5 shrink-0 text-center font-mono text-xs text-accent">{index + 1}</span>
                        <GiftThumb src={item.imageUrl} className="h-14 w-14 sm:h-16 sm:w-16" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold text-bright">{item.title}</p>
                          <p className="mt-0.5 truncate text-xs text-body">
                            {[
                              item.priceCents !== null ? formatPrice(item.priceCents) : null,
                              item.store,
                              item.quantity === null
                                ? copy.guest.noLimit
                                : item.quantity > 1
                                  ? copy.guest.wants(item.quantity)
                                  : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                          <button
                            type="button"
                            className={buttons.quiet}
                            onClick={() => {
                              setFormError(null);
                              setEditing(item.id);
                            }}
                          >
                            {copy.owner.editItem}
                          </button>
                          <button type="button" className={buttons.quiet} onClick={() => remove(item)}>
                            {copy.owner.remove}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
          <section className="glass rounded-[28px] p-5 sm:p-6">
            <h2 className="text-sm font-bold text-bright">{copy.owner.editTitle}</h2>
            <p className="mt-1.5 text-xs leading-relaxed">{copy.owner.editHint}</p>
            <CopyButton
              text={editUrl(slug, key)}
              label={copy.owner.copyEdit}
              done={copy.owner.copied}
              className={`${buttons.secondary} mt-3 w-full`}
            />
          </section>

          <section className="glass rounded-[28px] p-5 sm:p-6">
            <form onSubmit={saveDetails} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={buttons.label}>{copy.owner.titleLabel}</span>
                <input
                  value={details.title}
                  onChange={(e) => setDetails({ ...details, title: e.target.value })}
                  maxLength={LIMITS.title}
                  required
                  className={buttons.input}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={buttons.label}>{copy.owner.nameLabel}</span>
                <input
                  value={details.ownerName}
                  onChange={(e) => setDetails({ ...details, ownerName: e.target.value })}
                  maxLength={LIMITS.ownerName}
                  required
                  className={buttons.input}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={buttons.label}>{copy.owner.noteLabel}</span>
                <textarea
                  value={details.note}
                  onChange={(e) => setDetails({ ...details, note: e.target.value })}
                  maxLength={LIMITS.note}
                  rows={4}
                  className={`${buttons.input} resize-none`}
                />
              </label>
              <button
                type="submit"
                disabled={!detailsChanged || detailsState === "saving"}
                className={`${buttons.secondary} self-end`}
              >
                {detailsState === "saved" ? copy.owner.saved : copy.owner.save}
              </button>
            </form>
          </section>

          <section className="glass rounded-[28px] p-5 sm:p-6">
            <h2 className="text-sm font-bold text-bright">{copy.owner.fresh.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed">{copy.owner.fresh.body}</p>
            <button
              type="button"
              onClick={clearAll}
              disabled={fresh !== "idle"}
              className={`${buttons.secondary} mt-3 w-full`}
            >
              {fresh === "done" ? copy.owner.fresh.done : copy.owner.fresh.action}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="glass mx-auto max-w-xl rounded-[28px] p-8 text-center">
      <p className="text-base text-bright">{text}</p>
      <Link href="/tools/gift-list" className={`${buttons.secondary} mt-5`}>
        {copy.guest.makeYours}
      </Link>
    </div>
  );
}

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />;
}
