/**
 * Tiny synthesized sound effects via the Web Audio API — no asset files, works
 * offline. All sounds are short blips; respects a mute flag.
 */
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean): void {
  muted = v;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  }
  if (ctx?.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'triangle', gain = 0.06): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(a.destination);
  const t = a.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  /** Pitch rises with the combo for a satisfying climb. */
  capture(combo = 0) {
    tone(420 + Math.min(combo, 14) * 38, 0.09, 'triangle', 0.05);
  },
  power() {
    tone(660, 0.08, 'square', 0.05);
    setTimeout(() => tone(990, 0.14, 'square', 0.05), 80);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.06), i * 130));
  },
};
