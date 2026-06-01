import { create } from 'zustand';
import {
  COOLDOWN_MS,
  GRID_COLS,
  GRID_ROWS,
  LOCK_MS,
  type LeaderboardEntry,
  type Snapshot,
  type User,
} from '@ctb/shared';

const STORAGE_KEY = 'ctb:identity';

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

  setMe: (user: User) => void;
  setJoined: (v: boolean) => void;
  setConnection: (c: ConnectionState) => void;
  setOnline: (n: number) => void;
  setLeaderboard: (lb: LeaderboardEntry[]) => void;
  setConfig: (c: Snapshot['config']) => void;
  startCooldown: (ms: number) => void;
  pushActivity: (items: ActivityItem[]) => void;
  clearActivity: () => void;
  pushToast: (kind: ToastKind, message: string) => void;
  removeToast: (id: number) => void;
  resolveUser: (id: string) => { name: string; color: string };
}

let toastSeq = 0;

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
  pushActivity: (items) =>
    set((s) => ({ activity: [...items, ...s.activity].slice(0, 24) })),
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
}));
