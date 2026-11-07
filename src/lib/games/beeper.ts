/**
 * Square wave beeps from Web Audio, so the game ships no sound files.
 *
 * Browsers only let audio start from a user gesture, so the context is made on
 * the first `play` call, which always comes from a key or a button press.
 */
import type { GameEvent } from "./football";

type Note = { freq: number; ms: number; gap?: number };

/** A referee's whistle, as near as a square wave gets: a fast warble between two high notes. */
const whistle = (gap = 0): Note[] => [
  { freq: 2350, ms: 45 },
  { freq: 2650, ms: 45 },
  { freq: 2350, ms: 45 },
  { freq: 2650, ms: 45, gap },
];

const fanfare: Note[] = [
  { freq: 523, ms: 110, gap: 20 },
  { freq: 659, ms: 110, gap: 20 },
  { freq: 784, ms: 110, gap: 20 },
  { freq: 1047, ms: 260 },
];

const buzzer: Note[] = [{ freq: 110, ms: 600 }];

const SOUNDS: Record<GameEvent, Note[]> = {
  snap: [],
  step: [{ freq: 1320, ms: 22 }],
  tackle: whistle(),
  turnover: [...whistle(120), ...whistle()],
  firstDown: [{ freq: 1568, ms: 90 }],
  touchdown: fanfare,
  fieldGoal: fanfare,
  safety: [
    { freq: 880, ms: 160, gap: 60 },
    { freq: 660, ms: 220 },
  ],
  kick: [
    { freq: 500, ms: 50 },
    { freq: 800, ms: 50 },
    { freq: 1100, ms: 70 },
  ],
  returnReady: [{ freq: 988, ms: 160 }],
  quarter: buzzer,
  final: buzzer,
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
