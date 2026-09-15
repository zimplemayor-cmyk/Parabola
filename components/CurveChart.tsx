"use client";

import { useMemo } from "react";
import { buildCurveShape, pointsToPath } from "@/lib/curveMath";

export function CurveChart({
  progress,
  width = 640,
  height = 280,
  showMarker = true,
}: {
  /** 0..1, how far along the curve the token currently is */
  progress: number;
  width?: number;
  height?: number;
  showMarker?: boolean;
}) {
  const points = useMemo(() => buildCurveShape(80), []);
  const path = useMemo(() => pointsToPath(points, width, height), [points, width, height]);

  const clamped = Math.min(Math.max(progress, 0), 0.97);
  const markerIndex = Math.round((clamped / 0.97) * (points.length - 1));
  const marker = points[markerIndex];
  const maxPrice = Math.max(...points.map((p) => p.price));
  const minPrice = Math.min(...points.map((p) => p.price));
  const range = maxPrice - minPrice || 1;
  const norm = Math.sqrt((marker.price - minPrice) / range);
  const markerX = 8 + marker.progress * (width - 16);
  const markerY = height - 8 - norm * (height - 16);

  const gradientId = "parabola-fill";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Bonding curve price chart">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2BB6E0" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#2BB6E0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${width - 8},${height} L8,${height} Z`} fill={`url(#${gradientId})`} />
      <path d={path} stroke="#2BB6E0" strokeWidth={3} fill="none" strokeLinecap="round" />
      {/* Graduation ring at the curve's end, echoing the logomark */}
      <circle cx={width - 8} cy={8} r={6} stroke="#3FD0C9" strokeWidth={2.5} className="fill-ink" />
      {showMarker && (
        <g>
          <line x1={markerX} y1={markerY} x2={markerX} y2={height} stroke="#3FD0C9" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
          <circle cx={markerX} cy={markerY} r={5.5} fill="#3FD0C9" stroke="#0E0E17" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
}
