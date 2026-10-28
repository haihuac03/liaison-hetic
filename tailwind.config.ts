import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F2F1EC",
        "cream-dark": "#EAE9E2",
        "cream-soft": "#F7F6F1",
        paper: "#FBFBF8",
        ink: "#1C272C",
        muted: "#5F686B",
        line: "#E7E6DF",
        petrol: {
          DEFAULT: "#243B47",
          dark: "#1A2C36",
          light: "#385360",
          soft: "#E4EAED",
        },
        sage: {
          DEFAULT: "#456C5A",
          dark: "#365645",
          light: "#DCEBE3",
          soft: "#EEF5F1",
        },
        mint: "#C2E7D4",
        peach: {
          DEFAULT: "#F8E2CB",
          dark: "#8A4C1F",
          soft: "#FBF0E4",
        },
        sky: {
          DEFAULT: "#E2EDF3",
          dark: "#2A566A",
          soft: "#F0F5F8",
        },
        danger: "#B44234",
      },
      borderRadius: {
        card: "18px",
        tile: "12px",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
        headline: ["'Plus Jakarta Sans'", "Manrope", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,39,44,0.03), 0 12px 28px -20px rgba(28,39,44,0.16)",
        lift: "0 2px 4px rgba(28,39,44,0.03), 0 22px 45px -28px rgba(28,39,44,0.24)",
        float: "0 18px 60px -12px rgba(28,39,44,0.28)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(.97) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-left": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".45" },
        },
        "scan-line": {
          "0%": { top: "8%" },
          "100%": { top: "92%" },
        },
      },
      animation: {
        "fade-up": "fade-up .45s cubic-bezier(.22,1,.36,1) both",
        "fade-in": "fade-in .3s ease both",
        "scale-in": "scale-in .28s cubic-bezier(.22,1,.36,1) both",
        "slide-left": "slide-left .3s cubic-bezier(.22,1,.36,1) both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "scan-line": "scan-line 2.2s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};
export default config;
