'use client';

import { useMemo, useRef, type CSSProperties, type PointerEvent } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { BOARD_H, BOARD_W, GRID_COLS, TILE_GAP_PX, TILE_PX, TILE_COUNT } from '@ctb/shared';
import { Tile } from './Tile';
import { PowerupLayer } from './PowerupLayer';
import { CursorLayer } from './CursorLayer';
import { sendCursor } from '@/lib/actions';
import { setMuted } from '@/lib/sfx';
import { useSessionStore } from '@/store/sessionStore';

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="glass flex h-10 w-10 items-center justify-center rounded-xl text-base text-[var(--text-dim)] transition hover:text-white hover:shadow-[0_0_18px_-4px_var(--accent)] sm:h-9 sm:w-9 sm:text-sm"
    >
      {children}
    </button>
  );
}

export function Board() {
  const ids = useMemo(() => Array.from({ length: TILE_COUNT }, (_, i) => i), []);
  const gridRef = useRef<HTMLDivElement>(null);
  const muted = useSessionStore((s) => s.muted);
  const toggleMuted = useSessionStore((s) => s.toggleMuted);

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_COLS}, ${TILE_PX}px)`,
    gridAutoRows: `${TILE_PX}px`,
    gap: `${TILE_GAP_PX}px`,
  };

  // Broadcast pointer position as a board-space fraction (rect reflects zoom/pan).
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = gridRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    sendCursor((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  const onToggleMute = () => {
    toggleMuted();
    setMuted(!muted);
  };

  return (
    // touch-action none lets the pan/zoom lib own touch gestures (pinch + drag).
    <div className="absolute inset-0 z-[1]" style={{ touchAction: 'none' }}>
      <TransformWrapper
        minScale={0.3}
        maxScale={6}
        initialScale={1}
        centerOnInit
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.08 }}
        pinch={{ step: 5 }}
        panning={{ velocityDisabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%', cursor: 'grab' }}
              contentStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                className="rounded-2xl p-3"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px rgba(0,0,0,0.4), 0 50px 130px -55px #000',
                }}
              >
                {/* wrapper sized to the EXACT grid box so overlays (power-ups, cursors) align */}
                <div
                  ref={gridRef}
                  className="relative"
                  style={{ width: BOARD_W, height: BOARD_H }}
                  onPointerMove={onPointerMove}
                >
                  <div style={gridStyle}>
                    {ids.map((i) => (
                      <Tile key={i} id={i} />
                    ))}
                  </div>
                  <PowerupLayer />
                  <CursorLayer />
                </div>
              </div>
            </TransformComponent>

            <div className="absolute bottom-6 left-4 z-30 flex flex-col gap-2">
              <ControlButton label="Zoom in" onClick={() => zoomIn()}>+</ControlButton>
              <ControlButton label="Zoom out" onClick={() => zoomOut()}>−</ControlButton>
              <ControlButton label="Reset view" onClick={() => resetTransform()}>⤾</ControlButton>
              <ControlButton label={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
                {muted ? '🔇' : '🔊'}
              </ControlButton>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
