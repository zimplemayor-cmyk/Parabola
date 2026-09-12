export function ParabolaMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      {/* The mark IS the product: a token launches at the dot, arcs through
         the bonding curve, and graduates into the open ring — the same
         shape as the price chart on every token page. */}
      <path
        d="M6 34C6 34 14 12 24 12C34 12 42 34 42 34"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="text-ignite"
      />
      <circle cx="6" cy="34" r="3.5" fill="currentColor" className="text-ignite" />
      <circle cx="42" cy="34" r="4.5" stroke="currentColor" strokeWidth="3" className="text-stable" fill="none" />
    </svg>
  );
}

export function ParabolaWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <ParabolaMark className="h-7 w-7" />
      <span className="font-display text-lg font-semibold tracking-tight text-paper">parabola</span>
    </span>
  );
}
