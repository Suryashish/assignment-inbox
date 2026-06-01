/**
 * Game-wide constants shared by client + server. These define the board, the
 * rules, and the broadcast cadence. Changing a value here changes both ends at
 * once — the whole point of the shared package.
 */

/** Board dimensions. 32×32 = 1024 tiles ("hundreds"); safe to push to a few thousand. */
export const GRID_COLS = 32;
export const GRID_ROWS = 32;
export const TILE_COUNT = GRID_COLS * GRID_ROWS;

/** Tile render geometry — shared so the grid and its overlays align exactly. */
export const TILE_PX = 20;
export const TILE_GAP_PX = 2;
export const TILE_PITCH_PX = TILE_PX + TILE_GAP_PX;
export const BOARD_W = GRID_COLS * TILE_PX + (GRID_COLS - 1) * TILE_GAP_PX;
export const BOARD_H = GRID_ROWS * TILE_PX + (GRID_ROWS - 1) * TILE_GAP_PX;

/** Per-user rate limit between captures (ms). Also the natural load governor. */
export const COOLDOWN_MS = 20;

/** A freshly captured tile is shielded this long (ms). Set 0 for pure overwrite. */
export const LOCK_MS = 1500;

/** Server broadcast batch-flush interval (ms). ~16fps — decouples fan-out from claim rate. */
export const TICK_MS = 60;

/** How many leaderboard rows the server sends / the client shows. */
export const LEADERBOARD_SIZE = 8;

/** Round length (ms). The server may override via the ROUND_MS env var. */
export const ROUND_MS = 120_000;
/** Pause between rounds for the winner celebration (ms). */
export const ROUND_INTERMISSION_MS = 4500;

/** Power-up spawning. */
export const POWERUP_SPAWN_MS = 11_000; // try to spawn one this often
export const POWERUP_TTL_MS = 16_000; // despawns if not grabbed
export const MAX_POWERUPS = 3; // max live on the board at once

/**
 * Curated pastel palette — desaturated and mutually harmonious so the board
 * reads as a cohesive whole on a near-black backdrop, never a clashing mess.
 * `id` is stored; `hex` is the render color.
 */
export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
}

export const PALETTE: readonly PaletteColor[] = [
  { id: 'periwinkle', name: 'Periwinkle', hex: '#9aa6ff' },
  { id: 'mint', name: 'Mint', hex: '#8fe3c4' },
  { id: 'blush', name: 'Blush', hex: '#ff9ec4' },
  { id: 'peach', name: 'Peach', hex: '#ffb38a' },
  { id: 'butter', name: 'Butter', hex: '#f3d98b' },
  { id: 'sky', name: 'Sky', hex: '#8fd2ff' },
  { id: 'lilac', name: 'Lilac', hex: '#c9a6ff' },
  { id: 'sage', name: 'Sage', hex: '#bcd99a' },
  { id: 'coral', name: 'Coral', hex: '#ff9a9a' },
  { id: 'aqua', name: 'Aqua', hex: '#7fe6e0' },
  { id: 'rose', name: 'Rose', hex: '#e6a6c7' },
  { id: 'sand', name: 'Sand', hex: '#d8c7a6' },
] as const;

const PALETTE_BY_ID = new Map(PALETTE.map((c) => [c.id, c]));

/** Resolve a palette id to its hex, falling back to the first color. */
export function colorHex(id: string): string {
  return PALETTE_BY_ID.get(id)?.hex ?? PALETTE[0]!.hex;
}

export function isValidColor(id: string): boolean {
  return PALETTE_BY_ID.has(id);
}

/** Clamp / validate a display name. Returns a safe, trimmed name. */
export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 18);
}

export function isValidName(raw: string): boolean {
  const n = sanitizeName(raw);
  return n.length >= 1 && n.length <= 18;
}

/** Convert a (col,row) coordinate to a row-major tile id and back. */
export function toTileId(col: number, row: number): number {
  return row * GRID_COLS + col;
}
export function fromTileId(id: number): { col: number; row: number } {
  return { col: id % GRID_COLS, row: Math.floor(id / GRID_COLS) };
}
export function isValidTileId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < TILE_COUNT;
}
