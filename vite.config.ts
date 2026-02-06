import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        ui: resolve(__dirname, "src/ui/index.html"),
        main: resolve(__dirname, "src/main/main.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "main") {
            return "main.js";
          }
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
