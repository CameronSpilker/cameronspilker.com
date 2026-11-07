/**
 * Square wave beeps from Web Audio, so the game ships no sound files.
 *
 * Browsers only let audio start from a user gesture, so the context is made on
 * the first `play` call, which always comes from a key or a button press.
 */
import type { GameEvent } from "./football";

type Note = { freq: number; ms: number; gap?: number };

const SOUNDS: Record<GameEvent, Note[]> = {
  snap: [],
  step: [{ freq: 1320, ms: 22 }],
  tackle: [{ freq: 140, ms: 380 }],
  firstDown: [
    { freq: 880, ms: 70, gap: 30 },
    { freq: 1175, ms: 110 },
  ],
  touchdown: [
    { freq: 523, ms: 110, gap: 20 },
    { freq: 659, ms: 110, gap: 20 },
    { freq: 784, ms: 110, gap: 20 },
    { freq: 1047, ms: 260 },
  ],
  fieldGoal: [
    { freq: 784, ms: 90, gap: 20 },
    { freq: 1047, ms: 180 },
  ],
  miss: [
    { freq: 330, ms: 140, gap: 20 },
    { freq: 220, ms: 260 },
  ],
  punt: [
    { freq: 600, ms: 60 },
    { freq: 900, ms: 60 },
    { freq: 1200, ms: 80 },
  ],
  quarter: [
    { freq: 440, ms: 200, gap: 80 },
    { freq: 440, ms: 200 },
  ],
  final: [
    { freq: 440, ms: 220, gap: 80 },
    { freq: 440, ms: 220, gap: 80 },
    { freq: 330, ms: 500 },
  ],
};

/** Quiet enough to sit under music, loud enough to hear on a phone speaker. */
const VOLUME = 0.06;

export function createBeeper() {
  let ctx: AudioContext | null = null;

  function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    return ctx;
  }

  return {
    play(event: GameEvent) {
      const notes = SOUNDS[event];
      if (notes.length === 0) return;
      const audio = context();
      if (!audio) return;
      if (audio.state === "suspended") void audio.resume();

      let at = audio.currentTime + 0.005;
      for (const note of notes) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "square";
        osc.frequency.value = note.freq;
        gain.gain.setValueAtTime(VOLUME, at);
        gain.gain.setValueAtTime(0, at + note.ms / 1000);
        osc.connect(gain).connect(audio.destination);
        osc.start(at);
        osc.stop(at + note.ms / 1000 + 0.01);
        at += (note.ms + (note.gap ?? 0)) / 1000;
      }
    },
    close() {
      void ctx?.close();
      ctx = null;
    },
  };
}
