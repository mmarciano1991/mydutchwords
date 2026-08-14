import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" so the build also works when served from a subfolder
// (the repo deploys to https://…/mydutchwords/ on Hostinger).
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    rollupOptions: {
      output: {
        // Splits the async App chunk (was a single 661 kB / 240 kB gzip
        // blob) into pieces that cache and download independently:
        // - vendor-react / vendor-supabase change far less often than app
        //   code, so a deploy that only touches src/ no longer invalidates
        //   a returning user's cached copy of either.
        // - dictionary-core is the bundled 14k-word list (data/core.generated
        //   + the dictionary.ts wrapper that decodes it) — the single
        //   largest block of app-owned bytes, per README's own accounting.
        //   It's still loaded up front (search/suggestions need the whole
        //   list — a deliberate product decision, not something this split
        //   changes), but as a separate HTTP/2 request it downloads in
        //   parallel with the rest of the app chunk instead of serializing
        //   behind it in one monolithic file.
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
