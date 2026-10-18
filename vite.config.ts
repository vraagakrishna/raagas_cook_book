import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      url: new URL("./src/shims/nodeUrl.ts", import.meta.url).pathname,
    },
  },
});
