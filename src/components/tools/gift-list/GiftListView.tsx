"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { giftListTool as copy } from "@/content/tools";
import { claimState } from "@/lib/gifts/claims";
import { LIMITS } from "@/lib/gifts/input";
import { formatPrice } from "@/lib/gifts/price";
import type { GiftItem, GiftList } from "@/lib/gifts/types";
import { ApiError, api, errorText, keyFor, myClaims, rememberClaim } from "./client";
import { ArrowOutIcon, CheckIcon, GiftIcon, GiftThumb, buttons } from "./parts";

const NAME_KEY = "gift-list-my-name";
const REFRESH_MS = 30_000;

/** `/tools/gift-list/[slug]`: what the people you share with see. */
export function GiftListView({ initial }: { initial: GiftList }) {
  const slug = initial.slug;
  const [list, setList] = useState(initial);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [ownerKey, setOwnerKey] = useState<string | null>(null);
  const [peek, setPeek] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setList(await api.get(slug));
    } catch {
      // Keep what is on screen; the next refresh may do better.
    }
  }, [slug]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reading storage after hydration */
    setMine(myClaims(slug));
    setOwnerKey(keyFor(slug));
    try {
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // No remembered name.
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    // Other people claim things too. Catch up when the page comes back into view.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [slug, refresh]);

  const isOwner = Boolean(ownerKey);
  const hideClaims = isOwner && !peek;

  const claim = async (item: GiftItem) => {
    setBusy(item.id);
    setMessage(null);
    const who = name.trim().slice(0, LIMITS.claimName) || null;
    try {
      localStorage.setItem(NAME_KEY, who ?? "");
    } catch {
      // Not remembered.
    }
    try {
      const { claimId, token } = await api.claim(slug, item.id, who);
      rememberClaim(slug, claimId, token);
      setMine((m) => ({ ...m, [claimId]: token }));
      setClaiming(null);
    } catch (e) {
      setMessage({ id: item.id, text: e instanceof ApiError && e.code === "full" ? copy.guest.just : errorText(e) });
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const undo = async (item: GiftItem, claimId: string) => {
    setBusy(item.id);
    setMessage(null);
    try {
      await api.unclaim(slug, claimId, mine[claimId]);
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "not_found")) {
        setMessage({ id: item.id, text: errorText(e) });
        setBusy(null);
        return;
      }
    }
    rememberClaim(slug, claimId, null);
    setMine((m) => {
      const next = { ...m };
      delete next[claimId];
      return next;
    });
    setBusy(null);
    void refresh();
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header>
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{copy.share.label}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight break-words text-bright sm:text-5xl">
          <span className="text-gradient">{list.title}</span>
        </h1>
      </header>

      {list.note && (
        <section className="glass flex gap-4 rounded-[28px] p-5 sm:p-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-raised">
            <GiftIcon className="h-5 w-5 text-accent" />
          </span>
          <p className="self-center text-base leading-relaxed whitespace-pre-line text-bright">{list.note}</p>
        </section>
      )}

      {isOwner && (
        <div className="flex flex-col gap-3 rounded-[28px] border border-accent/30 bg-surface/60 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{copy.guest.ownerBanner}</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" className={buttons.quiet} onClick={() => setPeek((p) => !p)}>
              {peek ? copy.guest.hide : copy.guest.peek}
            </button>
            <Link href={`/tools/gift-list/${slug}/edit#key=${ownerKey}`} className={buttons.secondary}>
              {copy.guest.editYours}
            </Link>
          </div>
        </div>
      )}

      {list.items.length === 0 ? (
        <p className="glass rounded-[28px] p-8 text-center text-sm">{copy.guest.empty}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {list.items.map((item, index) => {
            const shown = hideClaims ? { ...item, claims: [] } : item;
            const state = claimState(shown);
            const myClaim = shown.claims.find((c) => mine[c.id]);
            const named = shown.claims.find((c) => c.name)?.name ?? null;
            const struck = state.full;

            let status: string | null = null;
            if (myClaim) status = null;
            else if (item.quantity === null) status = copy.guest.openEnded(state.claimed) || null;
            else if (item.quantity > 1) status = state.claimed ? copy.guest.progress(state.claimed, item.quantity) : null;
            else if (struck) status = named ? copy.guest.takenBy(named) : copy.guest.taken;

            const details = [
              item.quantity === null ? copy.guest.noLimit : item.quantity > 1 ? copy.guest.wants(item.quantity) : null,
            ].filter(Boolean);

            return (
              <li
                key={item.id}
                className={`glass flex gap-4 rounded-[28px] p-3 transition-opacity sm:gap-5 sm:p-4 ${struck ? "opacity-70" : ""}`}
              >
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
                    <GiftThumb src={item.imageUrl} muted={struck} className="h-24 w-24 sm:h-32 sm:w-32" />
                  </a>
                ) : (
                  <GiftThumb src={item.imageUrl} muted={struck} className="h-24 w-24 sm:h-32 sm:w-32" />
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  {index < 3 && !struck && (
                    <span className="mb-1 self-start rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-accent uppercase">
                      {copy.guest.top}
                    </span>
                  )}
                  <p
                    className={`text-base leading-snug font-bold break-words sm:text-lg ${
                      struck ? "text-body line-through decoration-2" : "text-bright"
                    }`}
                  >
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm">
                    {item.priceCents !== null && (
                      <span className={`font-semibold ${struck ? "" : "text-bright"}`}>{formatPrice(item.priceCents)}</span>
                    )}
                    {item.priceCents !== null && item.store && <span className="text-body/60"> · </span>}
                    {item.store && <span>{item.store}</span>}
                    {details.length > 0 && (
                      <span className="text-body/80">
                        {(item.priceCents !== null || item.store) && <span className="text-body/60"> · </span>}
                        {details.join(" · ")}
                      </span>
                    )}
                  </p>
                  {item.note && <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-body">{item.note}</p>}

                  {status && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--viz-good)]">
                      <CheckIcon className="h-3.5 w-3.5" />
                      {status}
                    </p>
                  )}

                  {claiming === item.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void claim(item);
                      }}
                      className="mt-3 flex flex-col gap-2"
                    >
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={LIMITS.claimName}
                        placeholder={copy.guest.namePlaceholder}
                        aria-label={copy.guest.namePlaceholder}
                        autoFocus
                        className={`${buttons.input} rounded-full`}
                      />
                      <span className="pl-1 text-xs text-body/80">{copy.guest.nameHint}</span>
                      <div className="flex gap-2">
                        <button type="submit" disabled={busy === item.id} className={buttons.primary}>
                          {copy.guest.confirm}
                        </button>
                        <button type="button" onClick={() => setClaiming(null)} className={buttons.secondary}>
                          {copy.guest.cancel}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className={buttons.secondary}>
                          {copy.guest.buy(item.store)}
                          <ArrowOutIcon className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!isOwner && myClaim && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--viz-good)]/15 py-1.5 pr-1.5 pl-3 text-sm font-semibold text-bright">
                          <CheckIcon className="h-4 w-4 text-[var(--viz-good)]" />
                          {copy.guest.yours}
                          <button
                            type="button"
                            onClick={() => undo(item, myClaim.id)}
                            disabled={busy === item.id}
                            className="rounded-full px-2 py-0.5 text-xs font-semibold text-body underline-offset-2 hover:text-bright hover:underline"
                          >
                            {copy.guest.undo}
                          </button>
                        </span>
                      )}
                      {!isOwner && !myClaim && !struck && (
                        <button
                          type="button"
                          onClick={() => {
                            setMessage(null);
                            setClaiming(item.id);
                          }}
                          className={buttons.primary}
                        >
                          {item.quantity === 1 ? copy.guest.claim : copy.guest.claimOneMore}
                        </button>
                      )}
                    </div>
                  )}

                  {message?.id === item.id && (
                    <p role="alert" className="mt-2 text-sm text-[var(--viz-critical)]">
                      {message.text}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="pt-4 text-center">
        <Link href="/tools/gift-list" className="text-sm font-semibold text-accent hover:underline">
          {copy.guest.makeYours}
        </Link>
      </p>
    </div>
  );
}
