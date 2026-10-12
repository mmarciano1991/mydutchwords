import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
/** Downloaded sources. Gitignored; CI restores it from its own cache. */
export const CACHE_DIR = process.env.DICT_CACHE_DIR ?? join(ROOT, ".cache", "dictionary");
/** Build output: published entries, the doubt queue and the build report. */
export const OUT_DIR = process.env.DICT_OUT_DIR ?? join(ROOT, ".cache", "dictionary-build");
