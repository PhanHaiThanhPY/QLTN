const BUILDINGS = [
  { x: 0, w: 72, h: 70, variant: 'soft' },
  { x: 76, w: 54, h: 114, variant: 'bright' },
  { x: 134, w: 82, h: 84, variant: 'soft' },
  { x: 220, w: 62, h: 132, variant: 'blue' },
  { x: 286, w: 98, h: 96, variant: 'bright' },
  { x: 388, w: 58, h: 122, variant: 'soft' },
  { x: 450, w: 80, h: 78, variant: 'blue' },
  { x: 534, w: 64, h: 144, variant: 'bright' },
  { x: 602, w: 98, h: 94, variant: 'soft' },
] as const;

const BUILDING_FILL: Record<(typeof BUILDINGS)[number]['variant'], string> = {
  soft: '#e0f5fb',
  bright: '#f5fcff',
  blue: '#c8edf7',
};

/** Flat skyline illustration with varied building heights and illuminated windows. */
export const SkylineArt = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 700 180" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
    <defs>
      <filter id="skyline-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
    </defs>

    <ellipse cx="350" cy="168" rx="330" ry="22" fill="#bce7f4" opacity="0.4" filter="url(#skyline-glow)" />
    <path d="M0 167h700v13H0z" fill="#eaf9fd" opacity="0.95" />
    <path d="M0 167h700" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2" />

    {BUILDINGS.map((building, index) => {
      const top = 166 - building.h;
      const columns = Math.max(2, Math.floor((building.w - 14) / 16));
      const rows = Math.max(2, Math.floor((building.h - 18) / 17));
      const isLandmark = index === 4;

      return (
        <g key={building.x}>
          <rect x={building.x} y={top} width={building.w} height={166 - top} fill={BUILDING_FILL[building.variant]} />
          <path d={`M${building.x + 4} ${top + 2}h${building.w - 8}`} stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2" />
          {Array.from({ length: rows * columns }, (_, cell) => {
            const column = cell % columns;
            const row = Math.floor(cell / columns);
            const lit = (cell * 7 + index * 3) % 11 === 0;
            return (
              <rect
                key={cell}
                x={building.x + 8 + column * 16}
                y={top + 10 + row * 17}
                width={lit ? 8 : 7}
                height={lit ? 9 : 7}
                rx="1.5"
                fill={lit ? '#169bd1' : '#acddec'}
                opacity={lit ? 0.98 : 0.68}
              />
            );
          })}
          {isLandmark ? (
            <>
              <rect x={building.x + building.w / 2 - 5} y={top - 11} width="10" height="11" rx="2" fill="#dff7fd" />
              <path d={`M${building.x + building.w / 2} ${top - 11}V${top - 27}`} stroke="#e8fbff" strokeWidth="2" />
              <circle cx={building.x + building.w / 2} cy={top - 30} r="4" fill="#79dcfb" opacity="0.95" />
              <circle cx={building.x + building.w / 2} cy={top - 30} r="10" fill="#79dcfb" opacity="0.25" filter="url(#skyline-glow)" />
            </>
          ) : null}
        </g>
      );
    })}
  </svg>
);
