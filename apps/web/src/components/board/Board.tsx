'use client';

import { useMemo, type CSSProperties } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { GRID_COLS, TILE_COUNT } from '@ctb/shared';
import { Tile } from './Tile';

function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="glass flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] transition hover:text-white hover:shadow-[0_0_18px_-4px_var(--accent)]"
    >
      {children}
    </button>
  );
}

export function Board() {
  const ids = useMemo(() => Array.from({ length: TILE_COUNT }, (_, i) => i), []);

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_COLS}, 20px)`,
    gridAutoRows: '20px',
    gap: '2px',
  };

  return (
    <div className="absolute inset-0 z-[1]">
      <TransformWrapper
        minScale={0.4}
        maxScale={6}
        initialScale={1}
        centerOnInit
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        wheel={{ step: 0.08 }}
        panning={{ velocityDisabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Content fills the wrapper and flex-centers the grid, so the board
                stays centered + visible regardless of init measurement timing. */}
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
                <div style={gridStyle}>
                  {ids.map((i) => (
                    <Tile key={i} id={i} />
                  ))}
                </div>
              </div>
            </TransformComponent>

            <div className="absolute bottom-6 left-4 z-30 flex flex-col gap-2">
              <ZoomButton label="Zoom in" onClick={() => zoomIn()}>+</ZoomButton>
              <ZoomButton label="Zoom out" onClick={() => zoomOut()}>−</ZoomButton>
              <ZoomButton label="Reset view" onClick={() => resetTransform()}>⤾</ZoomButton>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
