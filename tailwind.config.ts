import type { Config } from "tailwindcss";

// Parabola's design system. See frontend design notes in README.md for the
// reasoning — short version: this deliberately avoids both of the two most
// common "generic AI app" looks (warm cream+terracotta, and near-black with
// a single neon accent). It's a night-sky/observatory palette with an
// ignition-orange accent for anything volatile/launch-related and a cool
// mint for anything stable/dollar-related — echoing the actual product
// duality of "stable USDC rails, volatile tokens on top."
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ink/paper resolve through CSS variables (see globals.css) so the
        // same utility classes (bg-ink, text-paper, etc.) automatically
        // repaint for light mode via the [data-theme="light"] selector —
        // no component-level dark: variants needed anywhere.
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          surface: "var(--ink-surface)",
          border: "var(--ink-border)",
        },
        paper: {
          DEFAULT: "var(--paper)",
          dim: "var(--paper-dim)",
          faint: "var(--paper-faint)",
        },
        // Brand accent — a saturated cerise/magenta rather than the far
        // more common orange-on-dark or purple-on-dark "crypto app"
        // accents, paired against the existing cool mint for the
        // volatile/stable duality described below.
        ignite: {
          DEFAULT: "#FF2D78",
          soft: "#FF6FA6",
          dim: "#5C1233",
        },
        stable: {
          DEFAULT: "#3FD0C9",
          soft: "#9DEEE8",
          dim: "#1F4A47",
        },
      },
      fontFamily: {
        // Monospace display headers instead of a generic sans — reads as a
        // deliberate "precision instrument" choice (this is a pricing/curve
        // product) rather than an unstyled default, using only fonts every
        // OS already ships. No next/font/google, no build-time external
        // fetch to a domain that may not always be reachable.
        display: ["ui-monospace", "SF Mono", "Cascadia Code", "Roboto Mono", "monospace"],
        body: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Cascadia Code", "Roboto Mono", "monospace"],
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, transparent, var(--ink)), radial-gradient(circle at 20% 20%, rgba(255,45,120,0.10), transparent 45%), radial-gradient(circle at 80% 0%, rgba(63,208,201,0.08), transparent 40%)",
      },
    },
  },
  plugins: [],
};

export default config;
