/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

// base: "./" so the build also works when served from a subfolder
// (the repo deploys to https://…/mydutchwords/ on Hostinger).
export default defineConfig({
  plugins: [react()],
  base: "./",
  // The release an error report belongs to (lib/errorReporting).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    // Agent worktrees under .claude/ hold full copies of the repo.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
  build: {
    rollupOptions: {
      output: {
        // vendor-react / vendor-supabase change far less often than app
        // code, so a deploy that only touches src/ leaves a returning user's
        // cached copy of either intact.
        manualChunks(id) {
          // .includes() needs an ES2015+ lib; tsconfig.node.json doesn't set
          // one, so this sticks to indexOf rather than widening that config
          // for one file.
          if (id.indexOf("node_modules") !== -1) {
            return id.indexOf("@supabase") !== -1 ? "vendor-supabase" : "vendor-react";
          }
        },
      },
    },
  },
});
