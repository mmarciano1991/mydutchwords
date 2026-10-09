import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Same build config, minus the agent worktrees under .claude/ — they hold
// full copies of src/, and collecting their tests too doubled every run.
export default mergeConfig(
  viteConfig,
  defineConfig({ test: { exclude: [...configDefaults.exclude, ".claude/**"] } })
);
