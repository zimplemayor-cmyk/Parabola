/**
 * Mirrors BondingCurve.sol's constant-product formula in plain JS numbers,
 * purely to draw the curve shape (hero animation, token detail chart).
 *
 * This is NOT used for anything a transaction depends on, every actual
 * trade quote in this app comes from the contract's own quoteBuy()/
 * quoteSell() view functions (see components/TradePanel.tsx), so a
 * floating-point rounding difference here can never cause a user to see a
 * price that doesn't match what they'd actually get on-chain.
 */
export interface CurvePoint {
  /** 0..1, share of curveSupply sold so far */
  progress: number;
  /** price in quote-per-whole-token, arbitrary relative units */
  price: number;
}

export function buildCurveShape(steps = 60): CurvePoint[] {
  const points: CurvePoint[] = [];
  // Same shape regardless of the absolute virtualQuoteReserve/curveSupply
  // chosen for a real launch, normalize x0=y0=1 and sample tokensSoldFrac
  // from 0 to ~0.97 (a real curve never reaches exactly 100% sold, since
  // price → infinity as remaining supply → 0).
  const x0 = 1;
  const y0 = 1;
  const k = x0 * y0;
  for (let i = 0; i <= steps; i++) {
    const soldFrac = (i / steps) * 0.97;
    const y = y0 * (1 - soldFrac);
    const x = k / y;
    const price = x / y;
    points.push({ progress: soldFrac, price });
  }
  return points;
}

/** Convenience for turning a set of points into an SVG path `d` attribute. */
export function pointsToPath(points: CurvePoint[], width: number, height: number, padding = 8): string {
  const maxPrice = Math.max(...points.map((p) => p.price));
  const minPrice = Math.min(...points.map((p) => p.price));
  const range = maxPrice - minPrice || 1;
  const toXY = (p: CurvePoint) => {
    const x = padding + p.progress * (width - padding * 2);
    // sqrt-compress the price axis, the raw curve is extremely convex near
    // the graduation end, and a linear axis makes the first 80% of the
    // chart look like a flat line. This is a display choice only.
    const norm = Math.sqrt((p.price - minPrice) / range);
    const y = height - padding - norm * (height - padding * 2);
    return [x, y];
  };
  return points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}
