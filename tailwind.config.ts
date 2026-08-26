import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        stream: {
          dark: "#0a0d14",
          card: "#121826",
          border: "#1f293d",
          accent: "#6366f1",
          accentHover: "#4f46e5",
          netflix: "#E50914",
          disney: "#0063E5",
          max: "#002BE7",
          prime: "#00A8E1",
          spotify: "#1DB954",
          crunchyroll: "#F47521"
        }
      },
    },
  },
  plugins: [],
};
export default config;
