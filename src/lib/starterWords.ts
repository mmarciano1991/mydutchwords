/* starterWords — the three words offered during onboarding to someone who
   would rather not type their first ones.

   Woordkast is not a curriculum: words normally come only from what the
   learner meets. So the starters are not a lesson either. They are words
   almost every expat in the Netherlands meets in their first weeks, one
   from each corner of daily life, so the first session feels relevant and
   the learner sees the kind of word the app is for.

   Every id here is a curated dictionary entry (it carries an example
   sentence); a test guards that. */

/** Pools, one word picked from each: letters & admin, errands & health,
 *  work & getting around. */
export const STARTER_POOLS: readonly (readonly string[])[] = [
  ["gemeente", "brief", "rekening", "belasting", "aanmelden"],
  ["afspraak", "huisarts", "apotheek", "kassa", "huur"],
  ["vergadering", "collega", "vertraging", "trein", "ophalen"],
];

export const STARTER_COUNT = STARTER_POOLS.length;

/** Three starter word ids, one per pool. `exclude` skips ids already shown,
 *  so "Pick different ones" really changes the set when it can. */
export function pickStarterWords(random: () => number = Math.random, exclude: ReadonlySet<string> = new Set()): string[] {
  return STARTER_POOLS.map((pool) => {
    const fresh = pool.filter((id) => !exclude.has(id));
    const from = fresh.length > 0 ? fresh : pool;
    return from[Math.floor(random() * from.length)];
  });
}
