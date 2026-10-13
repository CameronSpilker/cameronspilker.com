"use client";

import { useEffect, useRef } from "react";
import { isStageEvent, type PageCommand, type StageEvent } from "@/stage/protocol";

/**
 * The sandboxed iframe the character lives in, and the only door into it.
 *
 * `sandbox="allow-scripts"` without `allow-same-origin` gives the stage an
 * opaque origin, so nothing in it can read this page, its cookies or its
 * storage, and its CSP (next.config.ts) refuses all network access. Messages
 * are accepted only from this iframe's window and only in the shapes defined
 * in src/stage/protocol.ts.
 */
export function StageFrame({
  onEvent,
  onReady,
  title,
}: {
  onEvent: (event: StageEvent) => void;
  /** Called with a send function once the stage has booted. */
  onReady: (send: (command: PageCommand) => void) => void;
  title: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const handlers = useRef({ onEvent, onReady });
  useEffect(() => {
    handlers.current = { onEvent, onReady };
  });

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const send = (command: PageCommand) => frame.contentWindow?.postMessage(command, "*");
    const listen = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      if (!isStageEvent(event.data)) return;
      if (event.data.type === "ready") handlers.current.onReady(send);
      handlers.current.onEvent(event.data);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);

  return (
    <iframe
      ref={ref}
      title={title}
      src="/character-stage/index.html"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      allow=""
      className="block h-full w-full border-0"
    />
  );
}
