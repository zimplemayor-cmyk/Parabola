"use client";

import { useEffect, useState } from "react";
import { ParabolaMark } from "./ParabolaMark";

const SEEN_KEY = "parabola-splash-seen";
const PLAY_MS = 1900;

export function SplashIntro() {
  // null = not decided yet (avoids a flash on the very first paint while we
  // check sessionStorage); true = actively playing; false = skip/hidden.
  const [visible, setVisible] = useState<boolean | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(SEEN_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sessionStorage read, only possible client-side
      setVisible(false);
      return;
    }
    setVisible(true);
    const exitTimer = setTimeout(() => setExiting(true), PLAY_MS);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      window.sessionStorage.setItem(SEEN_KEY, "1");
    }, PLAY_MS + 500);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  function skip() {
    setExiting(true);
    window.sessionStorage.setItem(SEEN_KEY, "1");
    setTimeout(() => setVisible(false), 500);
  }

  if (!visible) return null;

  return (
    <div
      onClick={skip}
      className={`fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-ink transition-opacity duration-500 ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ perspective: "800px" }}
      aria-hidden="true"
    >
      <div className="splash-mark">
        <ParabolaMark className="h-20 w-20 text-ignite drop-shadow-[0_0_28px_rgba(43,182,224,0.4)]" />
      </div>
      <style>{`
        .splash-mark {
          animation: parabola-splash ${PLAY_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-style: preserve-3d;
          opacity: 0;
        }
        @keyframes parabola-splash {
          0% {
            opacity: 0;
            transform: translateY(28px) scale(0.6) rotateX(55deg) rotateY(-18deg);
          }
          55% {
            opacity: 1;
            transform: translateY(-6px) scale(1.08) rotateX(-8deg) rotateY(6deg);
          }
          75% {
            transform: translateY(0) scale(1) rotateX(4deg) rotateY(-2deg);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotateX(0deg) rotateY(0deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-mark {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
