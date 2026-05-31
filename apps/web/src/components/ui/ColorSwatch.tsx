'use client';

import { motion } from 'framer-motion';
import type { PaletteColor } from '@ctb/shared';

interface Props {
  color: PaletteColor;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function ColorSwatch({ color, selected, onSelect }: Props) {
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(color.id)}
      aria-label={color.name}
      aria-pressed={selected}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.92 }}
      className="relative h-9 w-9 rounded-lg"
      style={{
        background: color.hex,
        boxShadow: selected
          ? `0 0 0 2px var(--bg), 0 0 0 4px ${color.hex}, 0 0 18px -2px ${color.hex}`
          : `0 0 10px -4px ${color.hex}`,
      }}
    >
      {selected && (
        <motion.span
          layoutId="swatch-ring"
          className="absolute inset-0 rounded-lg"
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        />
      )}
    </motion.button>
  );
}
