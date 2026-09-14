"use client";

import type { Candle } from "@/lib/trades";

export function CandleChart({
  candles,
  width = 640,
  height = 280,
}: {
  candles: Candle[];
  width?: number;
  height?: number;
}) {
  const padding = 10;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const range = high - low || high || 1;

  const slot = (width - padding * 2) / candles.length;
  const bodyWidth = Math.max(2, Math.min(14, slot * 0.6));

  const y = (price: number) => height - padding - ((price - low) / range) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Price candlestick chart">
      {candles.map((c, i) => {
        const x = padding + i * slot + slot / 2;
        const up = c.close >= c.open;
        const color = up ? "#3FD0C9" : "#FF2D78";
        const bodyTop = y(Math.max(c.open, c.close));
        const bodyBottom = y(Math.min(c.open, c.close));
        return (
          <g key={c.time}>
            <line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke={color} strokeWidth={1.5} />
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={Math.max(1.5, bodyBottom - bodyTop)}
              fill={color}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
}
