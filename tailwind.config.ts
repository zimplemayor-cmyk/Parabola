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
        ink: {
          DEFAULT: "#0E0E17",
          soft: "#15151F",
          surface: "#1B1B28",
          border: "#2A2A3A",
        },
        paper: {
          DEFAULT: "#F4F1EC",
          dim: "#B8B6C4",
          faint: "#8B8A9A",
        },
        ignite: {
          DEFAULT: "#FF6B35",
          soft: "#FFA36C",
          dim: "#7A3A22",
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
          "linear-gradient(to bottom, transparent, #0E0E17), radial-gradient(circle at 20% 20%, rgba(255,107,53,0.10), transparent 45%), radial-gradient(circle at 80% 0%, rgba(63,208,201,0.08), transparent 40%)",
      },
    },
  },
  plugins: [],
};

export default config;
