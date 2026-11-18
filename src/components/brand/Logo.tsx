// Adsum mark (symbol "C1"): a tick with a round dot — someone raising a hand at roll call, "present!".
// Same geometry as app/icon.svg, the PWA icons in public/icons/ and docs/brand/.
// The wordmark is live text in the display font, so it stays crisp and is read by screen readers.

export const LOGO_PATHS = {
  tick: 'M14 58 L39 83 L87 23',
  dot: {cx: 29, cy: 30, r: 12},
} as const;

export function LogoSymbol({size = 26}: {size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d={LOGO_PATHS.tick} fill="none" stroke="var(--ink)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      <circle {...LOGO_PATHS.dot} fill="var(--logo-dot)" />
    </svg>
  );
}

/** Horizontal logo: symbol + "ad" in ink and "sum" in cobalt (Sidekick series wordmark). */
export function Logo() {
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
      <LogoSymbol />
      <span style={{fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em'}}>
        ad<span style={{color: 'var(--brand)'}}>sum</span>
      </span>
    </span>
  );
}

/** The days grid (option A): support graphic for empty states and month screens. */
export function DaysGrid({size = 44}: {size?: number}) {
  const marked = new Set(['0,2', '1,3', '2,2']);
  const cells = [];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const key = `${column},${row}`;
      const isToday = key === '3,1';
      cells.push(
        <rect
          key={key}
          x={column * 26}
          y={row * 26}
          width="20"
          height="20"
          rx="5"
          fill={isToday ? 'var(--logo-dot)' : 'var(--ink)'}
          fillOpacity={isToday || marked.has(key) ? 1 : 0.16}
        />,
      );
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 98 98" aria-hidden="true">
      {cells}
    </svg>
  );
}
