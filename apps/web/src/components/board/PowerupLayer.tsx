'use client';

import { motion } from 'framer-motion';
import { TILE_PITCH_PX, TILE_PX, fromTileId, type PowerUpType } from '@ctb/shared';
import { useGridStore } from '@/store/gridStore';

const ICON: Record<PowerUpType, string> = { bomb: '💣', burst: '🌟', shield: '🛡️' };

/** Overlay marking live power-up tiles, pixel-aligned to the grid cells. */
export function PowerupLayer() {
  const powerups = useGridStore((s) => s.powerups);
  if (powerups.size === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {[...powerups.entries()].map(([tileId, type]) => {
        const { col, row } = fromTileId(tileId);
        // exact tile-center in grid pixels
        const cx = col * TILE_PITCH_PX + TILE_PX / 2;
        const cy = row * TILE_PITCH_PX + TILE_PX / 2;
        return (
          <motion.div
            key={tileId}
            className="absolute flex items-center justify-center rounded-[3px]"
            style={{
              left: cx,
              top: cy,
              width: TILE_PX,
              height: TILE_PX,
              marginLeft: -TILE_PX / 2,
              marginTop: -TILE_PX / 2,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span
              className="absolute inset-0 rounded-[3px]"
              style={{ boxShadow: '0 0 10px 1px rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.16)' }}
            />
            <span className="relative text-[13px] leading-none">{ICON[type]}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
