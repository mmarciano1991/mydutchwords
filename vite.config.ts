import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" so the build also works when served from a subfolder
// (the repo deploys to https://…/mydutchwords/ on Hostinger).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
