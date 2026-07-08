import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        fly: {
          black: "#0a0a0a",
          charcoal: "#1a1a1a",
          gray: "#4a4a4a",
          lightgray: "#e5e5e5",
          gold: "#c9a227",
          goldlight: "#e0c258",
          white: "#ffffff"
        },
        risk: {
          low: "#2f9e44",
          medium: "#f08c00",
          high: "#e8590c",
          critical: "#c92a2a"
        }
      },
      fontFamily: {
        sans: ["Segoe UI", "Roboto", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
