"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { characterPage as copy } from "@/content/character";
import { requestCharacter, type ErrorCode, type Generated } from "@/lib/character/client";
import { checkFile, prepareImage, type Prepared } from "@/lib/character/prepare";
import type { CharacterResult } from "@/lib/character/schema";
import { ACTIONS, type ActionKey, type PageCommand, type StageEvent, type Style } from "@/stage/protocol";
import { StageFrame } from "./StageFrame";

type Step = "upload" | "working" | "play";
type Progress = "looking" | "building" | "ready";
type Built = Extract<StageEvent, { type: "built" }>;

/** Total wait before giving up on the server, a little over the 60 seconds aimed for plus one retry. */
const REQUEST_TIMEOUT_MS = 110_000;
/** How long the stage may go without answering a ping before it is treated as hung and removed. */
const STAGE_SILENCE_MS = 6_000;

function subscribeReducedMotion(onChange: () => void) {
  const q = window.matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function CharacterApp() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<Step>("upload");
  const [image, setImage] = useState<Prepared | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [name, setName] = useState("");
  const [style, setStyle] = useState<Style>("faithful");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<ErrorCode | "unreadable" | null>(null);
  const [progress, setProgress] = useState<Progress>("looking");
  const [character, setCharacter] = useState<CharacterResult | null>(null);
  const [fallback, setFallback] = useState(false);
  const [stageKey, setStageKey] = useState(0);
  const [stageOn, setStageOn] = useState(false);
  const [action, setAction] = useState<ActionKey | null>(null);
  const [spin, setSpin] = useState(false);
  const [compare, setCompare] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendRef = useRef<((c: PageCommand) => void) | null>(null);
  const listeners = useRef(new Set<(e: StageEvent) => void>());
  const readyWaiters = useRef(new Set<() => void>());
  const runId = useRef(0);

  // Lock page scroll while the full-screen stage is up.
  useEffect(() => {
    if (!stageOn) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [stageOn]);

  useEffect(() => {
    if (!compare) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCompare(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compare]);

  const onStageEvent = useCallback((event: StageEvent) => {
    if (event.type === "action") setAction(event.action);
    for (const l of listeners.current) l(event);
  }, []);
  const onStageReady = useCallback((send: (c: PageCommand) => void) => {
    sendRef.current = send;
    for (const w of readyWaiters.current) w();
    readyWaiters.current.clear();
  }, []);

  /** Mount a fresh stage iframe and wait for it to boot. */
  const freshStage = useCallback(() => {
    sendRef.current = null;
    setStageOn(true);
    setStageKey((k) => k + 1);
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        readyWaiters.current.delete(done);
        resolve(false);
      }, 20_000);
      const done = () => {
        clearTimeout(timer);
        resolve(true);
      };
      readyWaiters.current.add(done);
    });
  }, []);

  /**
   * Send a load to the stage and wait for its verdict. While waiting, ping it:
   * if it stops answering, its thread is stuck, and the iframe is torn down.
   */
  const loadOnStage = useCallback((command: PageCommand) => {
    return new Promise<Built | { type: "hung" }>((resolve) => {
      const send = sendRef.current;
      if (!send) return resolve({ type: "hung" });
      let lastPong = Date.now();
      let pingId = 0;
      const listener = (e: StageEvent) => {
        if (e.type === "pong") lastPong = Date.now();
        if (e.type === "built") finish(e);
      };
      const watchdog = setInterval(() => {
        if (Date.now() - lastPong > STAGE_SILENCE_MS) return finish({ type: "hung" });
        send({ type: "ping", id: ++pingId });
      }, 2_000);
      function finish(result: Built | { type: "hung" }) {
        clearInterval(watchdog);
        listeners.current.delete(listener);
        resolve(result);
      }
      listeners.current.add(listener);
      send(command);
    });
  }, []);

  const resetToUpload = useCallback((keepImage: boolean) => {
    abortRef.current?.abort("cancel");
    abortRef.current = null;
    runId.current++;
    sendRef.current = null;
    setStageOn(false);
    setCharacter(null);
    setFallback(false);
    setAction(null);
    setSpin(false);
    setCompare(false);
    setStep("upload");
    if (!keepImage) {
      setImage(null);
      setName("");
      setNotes("");
    }
  }, []);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    const problem = checkFile(file);
    if (problem) return setError(problem);
    setPreparing(true);
    try {
      setImage(await prepareImage(file));
    } catch {
      setError("unreadable");
    } finally {
      setPreparing(false);
    }
  }

  async function generate() {
    if (!image) return;
    const id = ++runId.current;
    const live = () => runId.current === id;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => ctrl.abort("timeout"), REQUEST_TIMEOUT_MS);
    setError(null);
    setProgress("looking");
    setStep("working");

    const fail = (code: ErrorCode) => {
      clearTimeout(timer);
      if (!live()) return;
      if (code !== "cancelled") setError(code);
      resetToUpload(true);
    };

    const body = { image: image.dataUrl, name, style, notes };
    let gen = (await devFixture()) ?? (await requestCharacter(body, { signal: ctrl.signal, onStage: (s) => live() && setProgress(s) }));
    if (!live()) return;
    if (!gen.ok) return fail(gen.code);

    setProgress("ready");
    setCharacter(gen.character);
    if (!(await freshStage()) || !live()) return fail("generation_failed");

    const load = (g: Generated): PageCommand => ({
      type: "load",
      builderCode: g.character.builderCode,
      style,
      palette: g.character.palette,
      reducedMotion,
    });
    let built = await loadOnStage(load(gen));
    if (!live()) return;

    // One repair: the sandbox's error goes back to Claude with the code it wrote.
    if (!(built.type === "built" && built.ok) && gen.ticket) {
      const error = built.type === "built" && !built.ok ? built.error : "The builder froze the page and had to be stopped. Avoid loops that may not end.";
      setProgress("building");
      const fix = await requestCharacter(
        { ...body, repair: { ticket: gen.ticket, previous: gen.raw, error } },
        { signal: ctrl.signal, onStage: (s) => live() && s === "building" && setProgress(s) },
      );
      if (!live()) return;
      if (fix.ok && fix.character.accepted) {
        gen = fix;
        setCharacter(fix.character);
        setProgress("ready");
        if (built.type === "hung" && !(await freshStage())) return fail("generation_failed");
        built = await loadOnStage(load(fix));
        if (!live()) return;
      }
    }

    // Still nothing: the stand-in, built by app code from the drawing's colours.
    if (!(built.type === "built" && built.ok)) {
      if (built.type === "hung" && !(await freshStage())) return fail("generation_failed");
      if (!live()) return;
      built = await loadOnStage({ type: "fallback", style, palette: gen.character.palette, reducedMotion });
      if (!live()) return;
      if (!(built.type === "built" && built.ok)) return fail("generation_failed");
      setFallback(true);
    }

    clearTimeout(timer);
    abortRef.current = null;
    setStep("play");
  }

  const send = (c: PageCommand) => sendRef.current?.(c);
  const actionLabel = action ? ACTIONS.find((a) => a.key === action)?.label : null;
  const errorText = error ? copy.errors[error === "cancelled" ? "generation_failed" : error] : null;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">{copy.label}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-bright sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">{copy.lede}</p>

        {errorText && (
          <div role="alert" className="mt-8 flex items-start justify-between gap-4 rounded-xl border border-line bg-raised px-4 py-3 text-sm text-bright">
            <span>{errorText}</span>
            <button type="button" onClick={() => setError(null)} className="shrink-0 font-mono text-xs text-accent hover:underline">
              {copy.errors.dismiss}
            </button>
          </div>
        )}

        <section className="mt-8">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pick(e.dataTransfer.files?.[0]);
            }}
            disabled={step !== "upload" || preparing}
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
              dragging ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-accent/60"
            }`}
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.dataUrl} alt="" className="max-h-64 max-w-full rounded-lg object-contain shadow" />
            ) : null}
            <span className="text-base font-medium text-bright">
              {preparing ? copy.upload.preparing : image ? copy.upload.replace : copy.upload.prompt}
            </span>
            {!image && <span className="font-mono text-xs text-body/70">{copy.upload.formats}</span>}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="mt-3 text-xs leading-relaxed text-body/80">{copy.upload.notice}</p>
        </section>

        <section className="mt-8 grid gap-6">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-bright">{copy.options.name.label}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={copy.options.name.placeholder}
              className="rounded-lg border border-line bg-surface px-3 py-2.5 text-bright placeholder:text-body/50 focus:border-accent focus:outline-none"
            />
          </label>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium text-bright">{copy.options.style.label}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["faithful", "realistic"] as const).map((s) => (
                <label
                  key={s}
                  className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                    style === s ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-line bg-surface hover:border-body/40"
                  }`}
                >
                  <input type="radio" name="style" value={s} checked={style === s} onChange={() => setStyle(s)} className="sr-only" />
                  <span
                    aria-hidden="true"
                    className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${style === s ? "border-accent" : "border-body/40"}`}
                  >
                    {style === s && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span>
                    <span className="block font-medium text-bright">{copy.options.style[s].label}</span>
                    <span className="mt-1 block text-sm leading-snug">{copy.options.style[s].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-bright">{copy.options.notes.label}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
              rows={2}
              placeholder={copy.options.notes.placeholder}
              className="resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-bright placeholder:text-body/50 focus:border-accent focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={!image || preparing || step !== "upload"}
            className="rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copy.generate}
          </button>
        </section>
      </main>

      {stageOn && (
        <div className="fixed inset-0 z-[60] flex h-[100dvh] flex-col bg-ink">
          <div className="relative min-h-0 flex-1">
            <StageFrame key={stageKey} title={character?.name ?? copy.title} onEvent={onStageEvent} onReady={onStageReady} />

            {step === "play" && character && (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
                  <h2 className="truncate text-2xl font-bold text-white">{character.name}</h2>
                  <p className="mt-0.5 text-xs text-white/90">{copy.play.help}</p>
                  <p aria-live="polite" className="mt-2 min-h-[1.5rem] text-base font-semibold text-white">
                    {actionLabel}
                  </p>
                </div>
                {image && (
                  <button
                    type="button"
                    onClick={() => setCompare(true)}
                    className="pointer-events-auto shrink-0 overflow-hidden rounded-lg border-2 border-white/80 shadow-lg"
                    aria-label={copy.play.compare}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.dataUrl} alt="" className="h-16 w-16 object-cover sm:h-20 sm:w-20" />
                  </button>
                )}
              </div>
            )}

            {step === "play" && fallback && (
              <p className="absolute inset-x-4 bottom-4 rounded-lg bg-ink/85 px-3 py-2 text-xs leading-snug text-bright sm:inset-x-auto sm:left-4 sm:max-w-md">
                {copy.play.fallback}
              </p>
            )}

            {step === "working" && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink p-4">
                <ProgressCard progress={progress} onCancel={() => resetToUpload(true)} />
              </div>
            )}
          </div>

          {step === "play" && (
            <nav aria-label="Actions" className="max-h-[40dvh] overflow-y-auto border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="mx-auto grid max-w-5xl grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2">
                {ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => send({ type: "play", action: a.key })}
                    aria-pressed={action === a.key}
                    className={`min-h-11 rounded-lg border px-2 py-2 text-sm leading-tight font-medium transition-colors ${
                      action === a.key ? "border-accent bg-accent text-ink" : "border-line bg-raised text-bright hover:border-accent/60"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => send({ type: "stop" })}
                  className="min-h-11 rounded-lg border border-line px-2 py-2 text-sm font-medium text-body hover:text-bright"
                >
                  {copy.play.stop}
                </button>
                <button
                  type="button"
                  aria-pressed={spin}
                  onClick={() => {
                    send({ type: "spin", on: !spin });
                    setSpin(!spin);
                  }}
                  className={`min-h-11 rounded-lg border px-2 py-2 text-sm font-medium ${
                    spin ? "border-accent bg-accent/15 text-bright" : "border-line text-body hover:text-bright"
                  }`}
                >
                  {copy.play.spin}
                </button>
                <button
                  type="button"
                  onClick={() => resetToUpload(false)}
                  className="min-h-11 rounded-lg border border-line px-2 py-2 text-sm font-medium text-accent hover:border-accent"
                >
                  {copy.play.another}
                </button>
              </div>
            </nav>
          )}

          {compare && image && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={copy.play.compare}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-ink/90 p-6"
              onClick={() => setCompare(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.dataUrl} alt={copy.play.compare} className="max-h-[75dvh] max-w-full rounded-xl object-contain shadow-2xl" />
              <button type="button" className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-bright">
                {copy.play.compareClose}
              </button>
            </div>
          )}
        </div>
      )}

      {step === "working" && !stageOn && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/95 p-4">
          <ProgressCard progress={progress} onCancel={() => resetToUpload(true)} />
        </div>
      )}
    </>
  );
}

/**
 * Development only: /character?fixture=tree (or pikachu) skips the API and
 * loads a hand-written builder, so actions and the stage can be worked on
 * without an API key. Never reachable in a production build.
 */
async function devFixture(): Promise<Generated | null> {
  if (process.env.NODE_ENV !== "development") return null;
  const which = new URLSearchParams(window.location.search).get("fixture");
  if (which !== "tree" && which !== "pikachu") return null;
  const { PIKACHU_BUILDER, TREE_BUILDER } = await import("@/lib/character/examples");
  const character: CharacterResult = {
    accepted: true,
    reason: "",
    name: which === "tree" ? "Ace's Tree" : "Ace's Pikachu",
    description: "Development fixture.",
    builderCode: which === "tree" ? TREE_BUILDER : PIKACHU_BUILDER,
    palette: which === "tree" ? ["#5b4332", "#a9d65c"] : ["#6fd3a0", "#cfd45a"],
    notes: "",
  };
  return { ok: true, character, raw: JSON.stringify(character), ticket: null };
}

function ProgressCard({ progress, onCancel }: { progress: Progress; onCancel: () => void }) {
  const order: Progress[] = ["looking", "building", "ready"];
  const at = order.indexOf(progress);
  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
      <h2 className="text-lg font-semibold text-bright">{copy.progress.title}</h2>
      <ol aria-live="polite" className="mt-5 grid gap-3">
        {order.map((p, i) => (
          <li key={p} className={`flex items-center gap-3 text-sm ${i <= at ? "text-bright" : "text-body/50"}`}>
            <span
              aria-hidden="true"
              className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${
                i < at ? "border-accent bg-accent text-ink" : i === at ? "animate-pulse border-accent motion-reduce:animate-none" : "border-line"
              }`}
            >
              {i < at ? "✓" : ""}
            </span>
            <span>
              {copy.progress.stages[p]}
              {i === at && <span className="sr-only"> (in progress)</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs text-body/80">{copy.progress.hint}</p>
      <button type="button" onClick={onCancel} className="mt-5 w-full rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-bright hover:border-accent">
        {copy.progress.cancel}
      </button>
    </div>
  );
}
