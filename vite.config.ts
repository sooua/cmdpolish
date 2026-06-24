import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tauri expects a fixed port and does not fall back if unavailable.
  clearScreen: false,
  server: {
    // Bind IPv4 explicitly: Tauri probes localhost→127.0.0.1, and on Windows a
    // default "localhost" bind can land on IPv6 ::1 only, which Tauri then can't
    // reach (the dev server appears to "never start").
    host: "127.0.0.1",
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
