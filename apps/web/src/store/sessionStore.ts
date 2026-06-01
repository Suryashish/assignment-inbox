import { create } from 'zustand';
import {
  COOLDOWN_MS,
  GRID_COLS,
  GRID_ROWS,
  LOCK_MS,
  ROUND_MS,
  type CursorInfo,
  type LeaderboardEntry,
  type RoundResult,
  type RoundState,
  type Snapshot,
  type User,
} from '@ctb/shared';

const STORAGE_KEY = 'ctb:identity';
const MUTE_KEY = 'ctb:muted';
const COMBO_WINDOW_MS = 1500;

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUTE_KEY) === '1';
}

export function loadIdentity(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function saveIdentity(user: User): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';
export type ToastKind = 'error' | 'warn' | 'info';

export interface ActivityItem {
  key: number;
  ownerId: string;
  name: string;
  color: string;
  count: number; // consecutive captures by this user, coalesced into one row
}
export interface Capture {
  ownerId: string;
  name: string;
  color: string;
}
export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface SessionState {
  me: User | null;
  joined: boolean;
  connection: ConnectionState;
  online: number;
  leaderboard: LeaderboardEntry[];
  config: Snapshot['config'];
  cooldownUntil: number;
  activity: ActivityItem[];
  toasts: ToastItem[];
  namesById: Record<string, { name: string; color: string }>;

  // round / match
  round: { id: number; durationMs: number };
  roundEndsAt: number; // local epoch ms
  roundResult: RoundResult | null;

  // live cursors of other players
  cursors: CursorInfo[];

  // combo + sound
  combo: number;
  comboExpiresAt: number;
  muted: boolean;

  setMe: (user: User) => void;
  setJoined: (v: boolean) => void;
  setConnection: (c: ConnectionState) => void;
  setOnline: (n: number) => void;
  setLeaderboard: (lb: LeaderboardEntry[]) => void;
  setConfig: (c: Snapshot['config']) => void;
  startCooldown: (ms: number) => void;
  recordCaptures: (captures: Capture[]) => void;
  clearActivity: () => void;
  pushToast: (kind: ToastKind, message: string) => void;
  removeToast: (id: number) => void;
  resolveUser: (id: string) => { name: string; color: string };
  setRound: (r: RoundState) => void;
  setRoundResult: (r: RoundResult | null) => void;
  setCursors: (c: CursorInfo[]) => void;
  bumpCombo: () => number;
  toggleMuted: () => void;
}

let toastSeq = 0;
let activitySeq = 0;

export const useSessionStore = create<SessionState>((set, get) => ({
  me: loadIdentity(),
  joined: false,
  connection: 'connecting',
  online: 0,
  leaderboard: [],
  config: { cols: GRID_COLS, rows: GRID_ROWS, cooldownMs: COOLDOWN_MS, lockMs: LOCK_MS },
  cooldownUntil: 0,
  activity: [],
  toasts: [],
  namesById: {},
  round: { id: 0, durationMs: ROUND_MS },
  roundEndsAt: 0,
  roundResult: null,
  cursors: [],
  combo: 0,
  comboExpiresAt: 0,
  muted: loadMuted(),

  setMe: (user) => {
    saveIdentity(user);
    set((s) => ({
      me: user,
      namesById: { ...s.namesById, [user.id]: { name: user.name, color: user.color } },
    }));
  },
  setJoined: (joined) => set({ joined }),
  setConnection: (connection) => set({ connection }),
  setOnline: (online) => set({ online }),
  setConfig: (config) => set({ config }),
  setLeaderboard: (leaderboard) =>
    set((s) => {
      const namesById = { ...s.namesById };
      for (const e of leaderboard) namesById[e.userId] = { name: e.name, color: e.color };
      return { leaderboard, namesById };
    }),
  startCooldown: (ms) => set({ cooldownUntil: Date.now() + ms }),
  recordCaptures: (captures) =>
    set((s) => {
      if (captures.length === 0) return s;
      const activity = s.activity.slice();
      for (const c of captures) {
        const head = activity[0];
        // Coalesce consecutive captures by the same user into one counting row.
        if (head && head.ownerId === c.ownerId) {
          activity[0] = { ...head, count: head.count + 1, name: c.name, color: c.color };
        } else {
          activity.unshift({ key: ++activitySeq, ownerId: c.ownerId, name: c.name, color: c.color, count: 1 });
        }
      }
      return { activity: activity.slice(0, 24) };
    }),
  clearActivity: () => set({ activity: [] }),
  pushToast: (kind, message) =>
    set((s) => {
      // De-dupe: don't stack an identical toast (prevents spam when rapidly
      // clicking a shielded tile now that the cooldown no longer throttles clicks).
      if (s.toasts.some((t) => t.kind === kind && t.message === message)) return s;
      return { toasts: [...s.toasts, { id: ++toastSeq, kind, message }].slice(-4) };
    }),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  resolveUser: (id) => {
    const known = get().namesById[id];
    if (known) return known;
    return { name: 'a player', color: 'periwinkle' };
  },
  setRound: (r) => set({ round: { id: r.id, durationMs: r.durationMs }, roundEndsAt: Date.now() + r.remainingMs }),
  setRoundResult: (roundResult) => set({ roundResult }),
  setCursors: (cursors) => set({ cursors }),
  bumpCombo: () => {
    const now = Date.now();
    const s = get();
    const combo = now < s.comboExpiresAt ? s.combo + 1 : 1;
    set({ combo, comboExpiresAt: now + COMBO_WINDOW_MS });
    return combo;
  },
  toggleMuted: () =>
    set((s) => {
      const muted = !s.muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        /* ignore */
      }
      return { muted };
    }),
}));
