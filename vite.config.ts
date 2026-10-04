/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

// base: "./" so the build also works when served from a subfolder
// (the repo deploys to https://…/mydutchwords/ on Hostinger).
export default defineConfig({
  plugins: [react()],
  base: "./",
  test: {
    // Agent worktrees under .claude/ hold full copies of the repo.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
  build: {
    rollupOptions: {
      output: {
        // Splits the async App chunk into pieces that cache and download
        // independently:
        // - vendor-react / vendor-supabase change far less often than app
        //   code, so a deploy that only touches src/ leaves a returning
        //   user's cached copy of either intact.
        // - dictionary-core is the bundled 14k-word list (data/core.generated
        //   + the dictionary.ts wrapper that decodes it) — the single
        //   largest block of app-owned bytes. It loads up front (search and
        //   suggestions need the whole list), but as a separate HTTP/2
        //   request it downloads in parallel with the rest of the app chunk.
        manualChunks(id) {
          // .includes() needs an ES2015+ lib; tsconfig.node.json doesn't set
          // one, so this sticks to indexOf rather than widening that config
          // for one file.
          if (id.indexOf("node_modules") !== -1) {
            return id.indexOf("@supabase") !== -1 ? "vendor-supabase" : "vendor-react";
          }
          if (id.indexOf("/src/data/core.generated") !== -1 || id.indexOf("/src/data/dictionary.ts") !== -1) {
            return "dictionary-core";
          }
        },
      },
    },
  },
});
