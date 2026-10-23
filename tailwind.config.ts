import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        ring: "hsl(var(--ring))",
        paper: "#FFF8F0",
        grape: "#22104A",
        coral: "#FF5A47",
        lime: "#C9F24D",
        lilac: "#DCD0FF",
        blush: "#FFE3DB"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"]
      },
      borderRadius: { DEFAULT: "var(--radius)" }
    }
  },
  plugins: []
} satisfies Config;
