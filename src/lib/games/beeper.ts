/**
 * The game's sounds, made with Web Audio at play time, so the game ships no
 * sound files.
 *
 * Browsers only let audio start from a real tap, click or key press, and
 * phones are strict about which: on an iPhone a finger landing on the glass
 * does not count, only the lift does. The game's buttons react the moment a
 * finger lands, so the page also calls `unlock` from taps, clicks and keys,
 * which wakes the audio up in time for the first sound.
 */
import type { GameEvent } from "./football";

type Wave = OscillatorType;
/** One note: pitch in Hz (a slide when `to` is set), length, the pause after it, its wave and loudness. */
export type Note = { freq: number; to?: number; ms: number; gap?: number; wave?: Wave; vol?: number };

/** A referee's whistle: a fast warble between two high notes. */
const whistle = (gap = 0): Note[] => [
  { freq: 2300, ms: 60, wave: "square", vol: 0.5 },
  { freq: 2700, ms: 60, wave: "square", vol: 0.5 },
  { freq: 2300, ms: 60, wave: "square", vol: 0.5 },
  { freq: 2700, ms: 90, gap, wave: "square", vol: 0.5 },
];

/** A touchdown: a rising call, a short pause, and a held top note. */
const touchdown: Note[] = [
  { freq: 392, ms: 120, gap: 20 },
  { freq: 523, ms: 120, gap: 20 },
  { freq: 659, ms: 120, gap: 20 },
  { freq: 784, ms: 220, gap: 90 },
  { freq: 659, ms: 120, gap: 20 },
  { freq: 784, ms: 520 },
];

const fieldGoal: Note[] = [
  { freq: 523, ms: 110, gap: 20 },
  { freq: 659, ms: 110, gap: 20 },
  { freq: 784, ms: 110, gap: 20 },
  { freq: 1047, ms: 380 },
];

const SOUNDS: Record<GameEvent, Note[]> = {
  snap: [{ freq: 220, ms: 70, wave: "square", vol: 0.45 }],
  step: [{ freq: 1100, ms: 40, wave: "square", vol: 0.35 }],
  tackle: whistle(),
  turnover: [...whistle(140), ...whistle()],
  firstDown: [
    { freq: 784, ms: 110, gap: 30 },
    { freq: 1175, ms: 200 },
  ],
  touchdown,
  fieldGoal,
  // A boot on the ball: a low thump sliding down, then the ball rising away.
  kick: [
    { freq: 160, to: 55, ms: 120, wave: "sine", vol: 1 },
    { freq: 400, to: 1200, ms: 220, wave: "triangle", vol: 0.5 },
  ],
  quarter: [{ freq: 110, ms: 650, wave: "sawtooth", vol: 0.5 }],
  final: [
    { freq: 110, ms: 500, gap: 120, wave: "sawtooth", vol: 0.5 },
    { freq: 110, ms: 900, wave: "sawtooth", vol: 0.5 },
  ],
};

/** Loud enough for a phone speaker at arm's length, and still not painful in headphones. */
const MASTER = 0.22;

/**
 * A tenth of a second of silence as a WAV file, about 800 bytes. On an iPhone
 * with the ring switch on silent, web audio makes no sound at all; playing a
 * real media element, even a silent one, moves the page into media playback
 * the way a video would, and the game's sounds come through. This is the
 * long standing fix for that, and it works on Safari versions that predate
 * the newer audio session setting below.
 */
const SILENT_WAV = "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

/** iPhones and iPads, including iPads that describe themselves as a Mac. */
function isAppleTouch(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function createBeeper() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let media: HTMLAudioElement | null = null;

  function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor =
      typeof window === "undefined"
        ? undefined
        : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      return null;
    }
    return ctx;
  }

  function schedule(audio: AudioContext, notes: Note[], startAt: number) {
    let at = startAt;
    for (const note of notes) {
      const osc = audio.createOscillator();
      const env = audio.createGain();
      const seconds = note.ms / 1000;
      osc.type = note.wave ?? "triangle";
      osc.frequency.setValueAtTime(note.freq, at);
      if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, at + seconds);
      // A few milliseconds of fade at each end, so notes start and stop without a click.
      const peak = note.vol ?? 0.8;
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(peak, at + 0.006);
      env.gain.setValueAtTime(peak, at + Math.max(0.006, seconds - 0.012));
      env.gain.linearRampToValueAtTime(0, at + seconds);
      osc.connect(env).connect(master!);
      osc.start(at);
      osc.stop(at + seconds + 0.02);
      at += seconds + (note.gap ?? 0) / 1000;
    }
  }

  return {
    /**
     * Call from a tap, click or key press. Makes the audio context if there
     * is none, wakes it if the browser put it to sleep, and plays one silent
     * sample, which is what finally convinces iPhones to make sound.
     */
    unlock() {
      const audio = context();
      if (!audio) return;
      // Safari 17 and later: count as media playback, so the ringer's silent switch does not mute the game.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session && session.type !== "playback") {
        try {
          session.type = "playback";
        } catch {
          // Older Safari: nothing to set.
        }
      }
      // Older Safari, or the newer setting refused: loop a silent track so the silent switch does not mute us.
      if (isAppleTouch()) {
        if (!media) {
          media = new Audio(SILENT_WAV);
          media.loop = true;
          media.preload = "auto";
          media.setAttribute("playsinline", "");
        }
        if (media.paused) void media.play().catch(() => undefined);
      }
      if (audio.state === "suspended") void audio.resume();
      const silence = audio.createBuffer(1, 1, 22050);
      const source = audio.createBufferSource();
      source.buffer = silence;
      source.connect(audio.destination);
      source.start(0);
    },
    /** Play a sound now, or `delayMs` from now. */
    play(event: GameEvent, delayMs = 0) {
      this.notes(SOUNDS[event], delayMs);
    },
    /** Play any run of notes now, or `delayMs` from now. Games other than Pixel Football bring their own. */
    notes(notes: Note[], delayMs = 0) {
      if (notes.length === 0) return;
      const audio = context();
      if (!audio) return;
      if (audio.state === "suspended") void audio.resume();
      schedule(audio, notes, audio.currentTime + 0.01 + delayMs / 1000);
    },
    /** Let go of the phone's media playback, when sound is turned off or the page is hidden. The next tap takes it back. */
    rest() {
      media?.pause();
    },
    close() {
      media?.pause();
      media = null;
      void ctx?.close();
      ctx = null;
      master = null;
    },
  };
}
