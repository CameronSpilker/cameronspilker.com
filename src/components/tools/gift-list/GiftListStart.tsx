"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { giftListTool as copy } from "@/content/tools";
import { LIMITS } from "@/lib/gifts/input";
import { api, errorText, ownedLists, rememberList, type OwnedList } from "./client";
import { GiftIcon, buttons } from "./parts";

/** `/tools/gift-list`: start a list, or get back to one this browser made. */
export function GiftListStart() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<OwnedList[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading storage after hydration
    setLists(ownedLists());
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const ownerName = name.trim();
    if (!ownerName || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { slug, editKey } = await api.create(ownerName);
      rememberList({ slug, key: editKey, title: copy.defaults.title(ownerName) });
      router.push(`/tools/gift-list/${slug}/edit#key=${editKey}`);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section className="glass rounded-[28px] p-6 sm:p-8">
        <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={buttons.label}>{copy.start.nameLabel}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIMITS.ownerName}
              placeholder={copy.start.namePlaceholder}
              autoComplete="given-name"
              className={`${buttons.input} rounded-full`}
            />
          </label>
          <button type="submit" disabled={!name.trim() || busy} className={`${buttons.primary} py-3 sm:px-7`}>
            {busy ? copy.start.creating : copy.start.create}
          </button>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-[var(--viz-critical)]">{error}</p>}

        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {copy.start.how.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface/50 p-4">
              <span className="font-mono text-xs text-accent">0{i + 1}</span>
              <p className="mt-1.5 text-sm font-bold text-bright">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs leading-relaxed text-body/80">{copy.start.stored}</p>
      </section>

      {lists.length > 0 && (
        <section className="glass rounded-[28px] p-5 sm:p-6">
          <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{copy.start.yours}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {lists.map((list) => (
              <li key={list.slug} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-raised">
                  <GiftIcon className="h-5 w-5 text-accent" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-bright">{list.title}</span>
                <Link href={`/tools/gift-list/${list.slug}`} className={buttons.quiet}>
                  {copy.start.view}
                </Link>
                <Link href={`/tools/gift-list/${list.slug}/edit#key=${list.key}`} className={buttons.quiet}>
                  {copy.start.edit}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
