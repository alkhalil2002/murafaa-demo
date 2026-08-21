import type { Config } from "tailwindcss";
import murafaaPreset from "./src/design/tailwind-preset";

/**
 * Theme lives in `src/design/` — tokens.css holds the values, tailwind-preset
 * exposes them as utilities. This file only declares what to scan.
 */
const config: Config = {
  presets: [murafaaPreset as Config],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/design/**/*.{ts,tsx}",
  ],
  plugins: [],
};

export default config;
