"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { pdfSignerTool as copy } from "@/content/tools";
import { clampBox, initialsOf, signedFileName, type Box } from "@/lib/pdf/geometry";
import {
  canvasToPng,
  checkMark,
  drawnSignature,
  INKS,
  TEXT_SIZE,
  textImage,
  typedSignature,
  type Ink,
  type Stroke,
} from "@/lib/pdf/ink";
import type { SampleId } from "@/lib/pdf/sample";
import { SIGNATURE_FONTS } from "./signatureFonts";
import { SignaturePad } from "./SignaturePad";

type Kind = keyof typeof copy.add.kinds;
const KINDS = Object.keys(copy.add.kinds) as Kind[];

/** A mark on a page. Images carry `src`, text marks carry `value`. */
type Mark = Box & { id: number; page: number; kind: Kind; src?: string; value?: string };

type Doc = {
  pdf: PDFDocumentProxy;
  bytes: Uint8Array;
  name: string;
  sample: SampleId | null;
  /** Each page's displayed size in points, rotation already applied. */
  pages: { width: number; height: number }[];
};

/** A text mark's starting height, as a share of the page: about 17pt on Letter. */
const TEXT_HEIGHT = 0.022;

const button =
  "rounded-md border border-line bg-ink px-3 py-2 text-sm text-bright transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function dataUrlBytes(url: string): Uint8Array {
  const binary = atob(url.split(",")[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function today() {
  return new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function PdfSigner() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [status, setStatus] = useState<"loading" | "opening" | "ready" | "failed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [armed, setArmed] = useState<Kind | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Held in memory only. Nothing about the signer is written to storage.
  const [name, setName] = useState("");
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [ink, setInk] = useState<Ink>("blue");
  const [font, setFont] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const padAspect = useRef(0.4);
  const onAspect = useCallback((aspect: number) => {
    padAspect.current = aspect;
  }, []);

  /** The open document's loading task, which is what pdf.js tears down. */
  const task = useRef<PDFDocumentLoadingTask | null>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const stage = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const nextId = useRef(1);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async (bytes: Uint8Array, fileName: string, sample: SampleId | null) => {
    setStatus(sample ? "loading" : "opening");
    setError(null);
    setSaved(null);
    setMarks([]);
    setSelected(null);
    setArmed(null);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      // pdf.js takes ownership of the buffer it is given, so it gets a copy and
      // the original stays whole for pdf-lib to write into on save.
      const loading = pdfjs.getDocument({ data: bytes.slice() });
      const opened = await loading.promise;
      const pages = [];
      for (let i = 1; i <= opened.numPages; i++) {
        const viewport = (await opened.getPage(i)).getViewport({ scale: 1 });
        pages.push({ width: viewport.width, height: viewport.height });
      }
      void task.current?.destroy();
      task.current = loading;
      setDoc({ pdf: opened, bytes, name: fileName, sample, pages });
      setStatus("ready");
    } catch (thrown) {
      setStatus("failed");
      setError(
        thrown instanceof Error && thrown.name === "PasswordException"
          ? copy.errors.password
          : copy.errors.unreadable,
      );
    }
  }, []);

  const loadSample = useCallback(
    async (id: SampleId) => {
      const option = copy.samples.options.find((sample) => sample.id === id);
      const { makeSamplePdf } = await import("@/lib/pdf/sample");
      await load(await makeSamplePdf(id), option?.fileName ?? "Sample.pdf", id);
    },
    [load],
  );

  /**
   * Open on a sample, for the same reason the run results tool does: a reader
   * can see what the thing does before deciding to find a file for it.
   */
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    void loadSample(copy.samples.options[0].id);
  }, [loadSample]);

  useEffect(() => () => void task.current?.destroy(), []);

  const openFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        setError(copy.errors.notPdf);
        return;
      }
      await load(new Uint8Array(await file.arrayBuffer()), file.name, null);
    },
    [load],
  );

  /** Drop handling, shared by the upload card and the document itself. */
  const dropTarget = {
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      void openFile(event.dataTransfer.files?.[0]);
    },
  };

  /** Fit a text mark's width to what it says, at its current height. */
  const fitText = useCallback((mark: Mark): Mark => {
    const el = pageEls.current[mark.page];
    if (!el) return mark;
    const px = mark.h * el.clientHeight * TEXT_SIZE;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return mark;
    ctx.font = `${px}px ${getComputedStyle(el).fontFamily}`;
    const width = ctx.measureText(mark.value || copy.add.textPlaceholder).width + px * 0.4;
    return { ...mark, w: Math.min(1 - mark.x, width / el.clientWidth) };
  }, []);

  const signatureImage = useCallback(
    async (kind: Kind): Promise<HTMLCanvasElement | null> => {
      const family = SIGNATURE_FONTS[font].family;
      if (kind === "check") return checkMark(ink);
      if (kind === "initials") {
        const initials = initialsOf(name);
        if (!initials) {
          say(copy.errors.noInitials);
          return null;
        }
        return typedSignature(initials, family, INKS[ink]);
      }
      if (tab === "draw") {
        const canvas = drawnSignature(strokes, padAspect.current, ink);
        if (!canvas) say(copy.errors.noDrawing);
        return canvas;
      }
      if (!name.trim()) {
        say(copy.errors.noName);
        return null;
      }
      return typedSignature(name.trim(), family, INKS[ink]);
    },
    [font, ink, name, say, strokes, tab],
  );

  const placeAt = useCallback(
    async (page: number, u: number, v: number) => {
      const kind = armed;
      if (!kind || !doc) return;
      setArmed(null);
      setSaved(null);
      const size = doc.pages[page];
      const id = nextId.current++;
      let mark: Mark;

      if (kind === "signature" || kind === "initials" || kind === "check") {
        const canvas = await signatureImage(kind);
        if (!canvas) return;
        const w = kind === "signature" ? 0.28 : kind === "initials" ? 0.09 : 0.025;
        const h = (w * (canvas.height / canvas.width) * size.width) / size.height;
        mark = { id, page, kind, src: canvas.toDataURL("image/png"), x: u - w / 2, y: v - h / 2, w, h };
      } else {
        const value = kind === "name" ? name.trim() : kind === "date" ? today() : "";
        if (kind === "name" && !value) {
          say(copy.errors.noName);
          return;
        }
        mark = { id, page, kind, value, x: u, y: v - TEXT_HEIGHT / 2, w: 0.2, h: TEXT_HEIGHT };
      }

      const placed = { ...mark, ...clampBox(mark) };
      setMarks((all) => [...all, mark.value === undefined ? placed : fitText(placed)]);
      setSelected(id);
      if (kind === "text") setFocusId(id);
    },
    [armed, doc, fitText, name, say, signatureImage],
  );

  const remove = useCallback((id: number) => {
    setMarks((all) => all.filter((mark) => mark.id !== id));
    setSelected((current) => (current === id ? null : current));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setArmed(null);
        setSelected(null);
      }
      const typing = document.activeElement instanceof HTMLInputElement;
      if ((event.key === "Delete" || event.key === "Backspace") && selected !== null && !typing) {
        event.preventDefault();
        remove(selected);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [remove, selected]);

  const arm = (kind: Kind) => {
    const next = armed === kind ? null : kind;
    setArmed(next);
    // On a phone the page is below the controls, so take the reader to it.
    if (next && window.matchMedia("(max-width: 1023px)").matches) {
      stage.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /** Move or resize a mark by dragging one of its handles. */
  const startDrag = (event: React.PointerEvent<HTMLElement>, origin: Mark, mode: "move" | "resize") => {
    const el = pageEls.current[origin.page];
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    setSelected(origin.id);
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const rect = el.getBoundingClientRect();
    const sx = event.clientX;
    const sy = event.clientY;

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / rect.width;
      const dy = (ev.clientY - sy) / rect.height;
      let next: Mark;
      if (mode === "move") next = { ...origin, x: origin.x + dx, y: origin.y + dy };
      else if (origin.src) {
        const w = Math.max(0.015, origin.w + dx);
        next = { ...origin, w, h: w * (origin.h / origin.w) };
      } else next = fitText({ ...origin, h: Math.max(0.008, origin.h + dy) });
      const box = clampBox(next);
      setMarks((all) => all.map((mark) => (mark.id === origin.id ? { ...next, ...box } : mark)));
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const filled = marks.filter((mark) => mark.src || mark.value?.trim());

  const save = async () => {
    if (!doc) return;
    if (filled.length === 0) {
      say(copy.errors.noMarks);
      return;
    }
    setSaving(true);
    try {
      const textFamily = getComputedStyle(document.body).fontFamily;
      const stamped = await Promise.all(
        filled.map(async (mark) => {
          const size = doc.pages[mark.page];
          const png = mark.src
            ? dataUrlBytes(mark.src)
            : await canvasToPng(
                await textImage(mark.value ?? "", textFamily, mark.w * size.width, mark.h * size.height),
              );
          return { page: mark.page, x: mark.x, y: mark.y, w: mark.w, h: mark.h, png };
        }),
      );
      const { stampPdf } = await import("@/lib/pdf/stamp");
      const out = await stampPdf(doc.bytes, stamped);
      const fileName = signedFileName(doc.name);
      download(out, fileName);
      setSaved(fileName);
      say(copy.finish.saved(fileName));
    } catch {
      say(copy.errors.build);
    } finally {
      setSaving(false);
    }
  };

  const busy = status === "loading" || status === "opening";
  const own = doc !== null && doc.sample === null;
  const outName = doc ? signedFileName(doc.name) : null;

  const downloadButton = (label: string) => (
    <button type="button" onClick={() => void save()} disabled={saving || !doc} className={`${primary} w-full whitespace-nowrap`}>
      <DownloadIcon />
      {saving ? copy.finish.saving : label}
    </button>
  );

  return (
    <div className="space-y-6 pb-28 lg:pb-0">
      {/* Step 1. The way in, and the first thing on the page. */}
      <section
        {...dropTarget}
        aria-labelledby="step-upload"
        className="rounded-xl border border-line bg-raised/40 p-5 sm:p-6"
      >
        <StepHeading id="step-upload" n={1} title={copy.steps.upload} />

        {own && !dragging ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-ink p-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileIcon />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-bright">{doc.name}</p>
                <p className="font-mono text-[11px] text-body/70">{copy.upload.pages(doc.pages.length)}</p>
              </div>
            </div>
            <button type="button" onClick={() => input.current?.click()} className={button}>
              {copy.upload.replace}
            </button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                input.current?.click();
              }
            }}
            className={`mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors sm:flex-row sm:gap-5 sm:px-6 sm:text-left ${
              dragging ? "border-accent bg-accent/10" : "border-line bg-ink hover:border-accent"
            }`}
          >
            <UploadIcon />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-bright">
                {dragging ? copy.upload.active : status === "opening" ? copy.upload.opening : copy.upload.drop}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-body/70">{copy.upload.note}</p>
            </div>
            <span className={`${primary} shrink-0`}>{copy.upload.choose}</span>
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label={copy.upload.choose}
          onChange={(event) => {
            void openFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-[color:var(--viz-critical)] bg-ink p-3 text-sm text-bright">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-body/80">{copy.samples.label}</span>
          {copy.samples.options.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={doc?.sample === option.id}
              onClick={() => void loadSample(option.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                doc?.sample === option.id
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-bright hover:border-accent hover:text-accent"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section
          ref={stage}
          {...dropTarget}
          aria-label={doc?.name ?? copy.steps.upload}
          className="order-2 min-w-0 scroll-mt-20 rounded-xl border border-line bg-surface p-3 sm:p-6 lg:order-1"
        >
          {doc && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="min-w-0 truncate font-mono text-xs text-bright">{doc.name}</p>
              {doc.sample && (
                <span className="rounded-full border border-[color:var(--viz-warning)]/60 px-2 py-0.5 font-mono text-[10px] tracking-wider text-[color:var(--viz-warning)] uppercase">
                  {copy.samples.showing}
                </span>
              )}
              {doc.sample && <p className="w-full text-xs text-body/80">{copy.samples.showingDetail}</p>}
            </div>
          )}

          {armed && (
            <div className="sticky top-16 z-20 mb-4 flex items-center justify-between gap-3 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-ink shadow-md">
              <span>{copy.add.armed(copy.add.kinds[armed])}</span>
              <button
                type="button"
                onClick={() => setArmed(null)}
                className="shrink-0 rounded border border-current px-2 py-0.5 text-xs"
              >
                {copy.add.cancel}
              </button>
            </div>
          )}

          <div className="mx-auto flex max-w-[880px] flex-col gap-6">
            {busy && !doc && (
              <p className="py-24 text-center font-mono text-xs text-body/70">{copy.upload.loading}</p>
            )}
            {doc &&
              doc.pages.map((size, index) => (
                <PdfPage
                  key={`${doc.name}-${doc.bytes.length}-${index}`}
                  pdf={doc.pdf}
                  index={index}
                  count={doc.pages.length}
                  size={size}
                  armed={armed !== null}
                  pageRef={(el) => {
                    pageEls.current[index] = el;
                  }}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).closest("[data-mark]")) return;
                    if (!armed) {
                      setSelected(null);
                      return;
                    }
                    // Without this the press goes on to focus the page itself,
                    // which takes focus straight back off a new text box.
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    void placeAt(
                      index,
                      (event.clientX - rect.left) / rect.width,
                      (event.clientY - rect.top) / rect.height,
                    );
                  }}
                >
                  {(heightPx) =>
                    marks
                      .filter((mark) => mark.page === index)
                      .map((mark) => (
                        <MarkView
                          key={mark.id}
                          mark={mark}
                          selected={selected === mark.id}
                          autoFocus={focusId === mark.id}
                          fontPx={mark.h * heightPx * TEXT_SIZE}
                          onSelect={() => setSelected(mark.id)}
                          onRemove={() => remove(mark.id)}
                          onDrag={(event, mode) => startDrag(event, mark, mode)}
                          onText={(value) =>
                            setMarks((all) => all.map((m) => (m.id === mark.id ? fitText({ ...m, value }) : m)))
                          }
                        />
                      ))
                  }
                </PdfPage>
              ))}
          </div>
        </section>

        {/* Capped at the window's height so step 4 is always reachable while the
            document scrolls past. */}
        <aside className="order-1 space-y-4 lg:sticky lg:top-20 lg:order-2 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain lg:pb-1">
          <section aria-labelledby="step-signature" className="rounded-xl border border-line bg-raised/40 p-5">
            <StepHeading id="step-signature" n={2} title={copy.steps.signature} />
            <label htmlFor="signer-name" className="mt-4 block text-sm font-medium text-bright">
              {copy.signature.name}
            </label>
            <input
              id="signer-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={copy.signature.namePlaceholder}
              className="mt-1.5 w-full rounded-md border border-line bg-ink px-3 py-2 text-base text-bright placeholder:text-body/50 focus:border-accent focus:outline-none sm:text-sm"
            />
            <p className="mt-1.5 text-xs text-body/70">{copy.signature.nameHint}</p>

            <div role="tablist" className="mt-4 grid grid-cols-2 rounded-md border border-line bg-ink p-0.5">
              {(["draw", "type"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`rounded px-2 py-1.5 text-sm transition-colors ${
                    tab === key ? "bg-accent font-medium text-ink" : "text-body hover:text-accent"
                  }`}
                >
                  {copy.signature[key]}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {tab === "draw" ? (
                <SignaturePad strokes={strokes} ink={ink} onChange={setStrokes} onAspect={onAspect} />
              ) : (
                <div className="flex flex-col gap-2">
                  {SIGNATURE_FONTS.map((option, index) => (
                    <button
                      key={option.name}
                      type="button"
                      aria-pressed={font === index}
                      aria-label={`${copy.signature.stylePrefix} ${option.name}`}
                      onClick={() => setFont(index)}
                      style={{ fontFamily: option.family, color: INKS[ink] }}
                      className={`min-h-13 truncate rounded-md border bg-white px-3 py-1.5 text-left text-2xl leading-normal ${
                        font === index ? "border-accent ring-2 ring-accent" : "border-line"
                      }`}
                    >
                      {name.trim() || copy.signature.namePreview}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div role="group" aria-label={copy.signature.inkLabel} className="flex gap-2">
                {(Object.keys(INKS) as Ink[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={ink === key}
                    aria-label={copy.signature.inks[key]}
                    onClick={() => setInk(key)}
                    style={{ backgroundColor: INKS[key] }}
                    className={`h-7 w-7 rounded-full border-2 border-surface ${
                      ink === key ? "ring-2 ring-accent" : "ring-1 ring-line"
                    }`}
                  />
                ))}
              </div>
              {tab === "draw" && (
                <button type="button" onClick={() => setStrokes([])} className={button}>
                  {copy.signature.clear}
                </button>
              )}
            </div>
          </section>

          <section aria-labelledby="step-place" className="rounded-xl border border-line bg-raised/40 p-5">
            <StepHeading id="step-place" n={3} title={copy.steps.place} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={armed === kind}
                  onClick={() => arm(kind)}
                  disabled={!doc}
                  className={`${button} text-left ${armed === kind ? "border-accent text-accent ring-1 ring-accent" : ""}`}
                >
                  {copy.add.kinds[kind]}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-body/70">{copy.add.hint}</p>
          </section>

          {/* On a phone this step lives in the bar pinned to the bottom. */}
          <section aria-labelledby="step-download" className="hidden rounded-xl border border-accent/50 bg-raised/40 p-5 lg:block">
            <StepHeading id="step-download" n={4} title={copy.steps.download} />
            <div className="mt-4">{downloadButton(copy.finish.save)}</div>
            <FinishNote doc={doc} outName={outName} count={filled.length} saved={saved} />
          </section>
        </aside>
      </div>

      {doc && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-bright">
                <span className="mr-1.5 font-mono text-accent">4</span>
                {copy.steps.download}
              </p>
              <p className="truncate font-mono text-[11px] text-body/70">
                {filled.length ? copy.finish.count(filled.length) : copy.finish.none}
              </p>
            </div>
            <div className="shrink-0">{downloadButton(copy.finish.saveShort)}</div>
          </div>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {toast}
      </p>
      {toast && (
        <div
          aria-hidden="true"
          className="fixed bottom-28 left-1/2 z-50 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md bg-bright px-4 py-2.5 text-center text-sm font-medium text-ink shadow-lg lg:bottom-6"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function StepHeading({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2.5 text-base font-semibold text-bright">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs text-ink"
      >
        {n}
      </span>
      {title}
    </h2>
  );
}

function FinishNote({
  doc,
  outName,
  count,
  saved,
}: {
  doc: Doc | null;
  outName: string | null;
  count: number;
  saved: string | null;
}) {
  if (!doc || !outName) return <p className="mt-3 text-xs text-body/70">{copy.finish.noDocument}</p>;
  return (
    <div className="mt-3 space-y-1">
      <p className="font-mono text-[11px] text-body/70 tabular-nums">
        {count ? copy.finish.count(count) : copy.finish.none}
      </p>
      <p className="truncate font-mono text-[11px] text-body/70">{copy.finish.savesAs(outName)}</p>
      {saved && <p className="pt-1 text-xs text-accent">{copy.finish.saved(saved)}</p>}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

/** One page of the document: the rendered canvas, with its marks laid over it. */
function PdfPage({
  pdf,
  index,
  count,
  size,
  armed,
  pageRef,
  onPointerDown,
  children,
}: {
  pdf: PDFDocumentProxy;
  index: number;
  count: number;
  size: { width: number; height: number };
  armed: boolean;
  pageRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  /** Given the page's on-screen height in pixels, which text marks size from. */
  children: (heightPx: number) => React.ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [height, setHeight] = useState(0);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    void (async () => {
      const el = canvas.current;
      const box = wrap.current;
      if (!el || !box) return;
      const page = await pdf.getPage(index + 1);
      if (cancelled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const scale = ((box.clientWidth || 800) * dpr) / size.width;
      const viewport = page.getViewport({ scale });
      el.width = Math.round(viewport.width);
      el.height = Math.round(viewport.height);
      const render = page.render({ canvas: el, viewport });
      task = render;
      try {
        await render.promise;
      } catch {
        // Cancelled by a newer document, which renders its own pages.
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, index, size.width]);

  // Text marks size their font from the page's on-screen height, so a resize
  // has to re-render them.
  useEffect(() => {
    const box = wrap.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setHeight(box.clientHeight));
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      {count > 1 && (
        <p className="mb-1.5 font-mono text-[11px] text-body/60">{copy.upload.page(index + 1, count)}</p>
      )}
      <div
        ref={(el) => {
          wrap.current = el;
          pageRef(el);
        }}
        onPointerDown={onPointerDown}
        style={{ aspectRatio: `${size.width} / ${size.height}` }}
        className={`relative w-full bg-white leading-none shadow-[0_1px_3px_rgba(0,0,0,0.18),0_8px_24px_rgba(0,0,0,0.08)] ${
          armed ? "cursor-crosshair ring-2 ring-accent/60" : ""
        }`}
      >
        <canvas ref={canvas} className="block h-auto w-full" />
        {children(height)}
      </div>
    </div>
  );
}

const handle =
  "absolute z-10 h-6 w-6 items-center justify-center rounded-full bg-[#1d3f9e] p-0 text-[13px] leading-none text-white shadow";

function MarkView({
  mark,
  selected,
  autoFocus,
  fontPx,
  onSelect,
  onRemove,
  onDrag,
  onText,
}: {
  mark: Mark;
  selected: boolean;
  autoFocus: boolean;
  fontPx: number;
  onSelect: () => void;
  onRemove: () => void;
  onDrag: (event: React.PointerEvent<HTMLElement>, mode: "move" | "resize") => void;
  onText: (value: string) => void;
}) {
  const shown = selected ? "flex" : "hidden group-hover:flex";
  const field = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);
  return (
    <div
      data-mark
      onPointerDown={(event) => {
        event.stopPropagation();
        if (mark.src) onDrag(event, "move");
        else onSelect();
      }}
      style={{
        left: `${mark.x * 100}%`,
        top: `${mark.y * 100}%`,
        width: `${mark.w * 100}%`,
        height: `${mark.h * 100}%`,
      }}
      className={`group absolute touch-none leading-none select-none ${mark.src ? "cursor-move" : "cursor-text"}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-1 rounded-[3px] border-[1.5px] border-dashed ${
          selected ? "border-[#1d3f9e]" : "border-transparent group-hover:border-[#1d3f9e]"
        }`}
      />
      {mark.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data URL made in the page, not an asset
        <img src={mark.src} alt={copy.add.kinds[mark.kind]} className="pointer-events-none block h-full w-full" />
      ) : (
        <>
          <button
            type="button"
            aria-label={copy.add.move}
            onPointerDown={(event) => onDrag(event, "move")}
            className={`${handle} ${shown} -top-4 -left-4 cursor-move touch-none text-[11px]`}
          >
            ✥
          </button>
          <input
            type="text"
            ref={field}
            value={mark.value}
            placeholder={copy.add.textPlaceholder}
            aria-label={copy.add.kinds[mark.kind]}
            onFocus={onSelect}
            onChange={(event) => onText(event.target.value)}
            style={{ fontSize: `${fontPx}px`, color: "#111111" }}
            className="h-full w-full overflow-hidden border-0 bg-[#1d3f9e]/5 p-0 whitespace-nowrap outline-none placeholder:text-[#9aa2ae]"
          />
        </>
      )}
      <button
        type="button"
        aria-label={copy.add.remove}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        className={`${handle} ${shown} -top-4 -right-4 cursor-pointer`}
      >
        ×
      </button>
      <button
        type="button"
        aria-label={copy.add.resize}
        onPointerDown={(event) => onDrag(event, "resize")}
        className={`${handle} ${shown} -right-4 -bottom-4 cursor-nwse-resize touch-none`}
      >
        ⤡
      </button>
    </div>
  );
}
