import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tauri expects a fixed port and does not fall back if unavailable.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't watch the Rust side from Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Produce a build Tauri can bundle.
  build: {
    target: "es2021",
    sourcemap: false,
  },
});
