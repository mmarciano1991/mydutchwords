const KEY = "woordkast.exercises";

type Pools = Record<string, string[]>;

function read(): Pools {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Pools) : {};
  } catch {
    return {};
  }
}

function write(pools: Pools): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pools));
  } catch {
    /* ignore */
  }
}

const MAX_PER_WORD = 6;

/** Cached exercise sentences previously generated for a word. */
export function getPool(wordId: string): string[] {
  return read()[wordId] ?? [];
}

/** Remember a freshly generated sentence (most recent first, deduped, capped). */
export function addToPool(wordId: string, sentence: string): void {
  const pools = read();
  const existing = pools[wordId] ?? [];
  const next = [sentence, ...existing.filter((s) => s !== sentence)].slice(0, MAX_PER_WORD);
  pools[wordId] = next;
  write(pools);
}

/** Pick a random cached sentence (used when offline / generation failed). */
export function pickFromPool(wordId: string): string | undefined {
  const pool = getPool(wordId);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
