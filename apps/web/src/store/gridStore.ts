import { create } from 'zustand';
import type { ClaimedTile, PowerUp, PowerUpType } from '@ctb/shared';

interface Optimistic {
  owner: string;
  color: string;
}

interface GridState {
  /** Authoritative claimed tiles, seq-guarded. Unchanged tiles keep their
   *  object reference so per-tile selectors don't re-render needlessly. */
  tiles: Map<number, ClaimedTile>;
  /** My in-flight clicks, painted instantly and reconciled on ack/broadcast. */
  optimistic: Map<number, Optimistic>;
  /** Live power-up tiles (tileId -> type), rendered as an overlay. */
  powerups: Map<number, PowerUpType>;

  applySnapshot: (tiles: ClaimedTile[], powerups?: PowerUp[]) => void;
  applyBatch: (tiles: ClaimedTile[]) => void;
  applyTile: (tile: ClaimedTile) => void;
  setOptimistic: (id: number, owner: string, color: string) => void;
  clearOptimistic: (id: number) => void;
  addPowerup: (p: PowerUp) => void;
  removePowerup: (tileId: number) => void;
}

export const useGridStore = create<GridState>((set) => ({
  tiles: new Map(),
  optimistic: new Map(),
  powerups: new Map(),

  applySnapshot: (incoming, powerups = []) =>
    set(() => {
      const tiles = new Map<number, ClaimedTile>();
      for (const t of incoming) tiles.set(t.id, t);
      const pu = new Map<number, PowerUpType>();
      for (const p of powerups) pu.set(p.tileId, p.type);
      return { tiles, optimistic: new Map(), powerups: pu };
    }),

  applyBatch: (incoming) =>
    set((s) => {
      const tiles = new Map(s.tiles);
      let optimistic: Map<number, Optimistic> | null = null;
      let changed = false;

      for (const t of incoming) {
        const cur = tiles.get(t.id);
        if (!cur || t.seq > cur.seq) {
          tiles.set(t.id, t);
          changed = true;
        }
        // Any authoritative word on a tile retires my optimistic overlay for it.
        if (s.optimistic.has(t.id)) {
          optimistic ??= new Map(s.optimistic);
          optimistic.delete(t.id);
        }
      }

      if (!changed && !optimistic) return {};
      return optimistic ? { tiles, optimistic } : { tiles };
    }),

  applyTile: (t) =>
    set((s) => {
      const cur = s.tiles.get(t.id);
      if (cur && t.seq <= cur.seq) return {};
      const tiles = new Map(s.tiles);
      tiles.set(t.id, t);
      return { tiles };
    }),

  setOptimistic: (id, owner, color) =>
    set((s) => {
      const optimistic = new Map(s.optimistic);
      optimistic.set(id, { owner, color });
      return { optimistic };
    }),

  clearOptimistic: (id) =>
    set((s) => {
      if (!s.optimistic.has(id)) return {};
      const optimistic = new Map(s.optimistic);
      optimistic.delete(id);
      return { optimistic };
    }),

  addPowerup: (p) =>
    set((s) => {
      const powerups = new Map(s.powerups);
      powerups.set(p.tileId, p.type);
      return { powerups };
    }),

  removePowerup: (tileId) =>
    set((s) => {
      if (!s.powerups.has(tileId)) return {};
      const powerups = new Map(s.powerups);
      powerups.delete(tileId);
      return { powerups };
    }),
}));
