/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Custom color tokens ───────────────────────────────────────────────
      colors: {
        deep:   "#060c18",       // outermost background — deepest hull
        hull:   "#0a1120",       // sidebar / header background
        panel:  "#0d1829",       // card / panel surface
        alloy:  "#1a2740",       // border / hairline color
        amber: {
          DEFAULT: "#f59e0b",
          400:     "#fbbf24",
          500:     "#f59e0b",
        },
      },

      // ── Custom fonts ──────────────────────────────────────────────────────
      fontFamily: {
        // Industrial condensed display — headings and labels
        display: ["'Barlow Condensed'", "sans-serif"],
        // Monospaced data — values, codes, timestamps
        mono:    ["'JetBrains Mono'", "'Fira Code'", "monospace"],
        // Comfortable body text
        sans:    ["'IBM Plex Sans'", "sans-serif"],
      },

      // ── Custom animations ─────────────────────────────────────────────────
      animation: {
        "ping-slow": "ping 3s cubic-bezier(0,0,0.2,1) infinite",
      },

      // ── Border radius tokens ──────────────────────────────────────────────
      borderRadius: {
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
      },
    },
  },
  plugins: [],
};
