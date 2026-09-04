import type { Config } from "tailwindcss";

/**
 * "Compass Midnight" — cinematic dark identity.
 * Layered deep-space ground (violet/cyan light pools painted in
 * globals.css), frosted-glass cards, one indigo→violet→cyan gradient
 * for primary action, amber/green/red kept strictly functional.
 *
 * NOTE: token NAMES are kept from the light theme (paper/card/blue/…)
 * so every screen restyles without structural edits — only the VALUES
 * changed. `font-serif` now maps to Space Grotesk (display), `font-sans`
 * to Inter.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#070b14",
        card: "#111a2c",
        line: { DEFAULT: "rgba(148,163,184,0.14)", strong: "rgba(148,163,184,0.30)" },
        ink: { DEFAULT: "#eef2f9", soft: "#b6c2d4", faint: "#7d8aa0" },
        blue: { DEFAULT: "#5b6cff", deep: "#a5b4fc", wash: "rgba(91,108,255,0.14)" },
        amber: { DEFAULT: "#f5c26b", wash: "rgba(245,178,72,0.12)" },
        green: { DEFAULT: "#4ade80", wash: "rgba(74,222,128,0.10)" },
        red: { DEFAULT: "#f87171", wash: "rgba(248,113,113,0.10)" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(2,6,16,0.45)",
        raised:
          "0 0 0 1px rgba(124,140,255,0.22), 0 0 28px rgba(99,102,241,0.22), 0 18px 48px rgba(2,6,16,0.6)",
        tray: "0 0 0 1px rgba(124,140,255,0.18), 0 -8px 40px rgba(2,6,16,0.7)",
        glow: "0 0 24px rgba(109,93,246,0.45)",
      },
      maxWidth: { shell: "1120px" },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(4%, -3%, 0) scale(1.08)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(10px)" },
          // MUST end at `none`, not translateY(0): with fill-mode `both` a
          // retained transform creates a permanent stacking context that
          // traps dropdown z-indexes beneath later siblings.
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        drift: "drift 16s ease-in-out infinite",
        "drift-slow": "drift 24s ease-in-out infinite reverse",
        shimmer: "shimmer 1.6s linear infinite",
        rise: "rise .45s cubic-bezier(0.22,0.7,0.3,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
