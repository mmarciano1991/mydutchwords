# 14-day pilot — tracking what each user is learning

You want to run the app with a group of testers for two weeks, then survey
them on the words the app says they've learned. This doc is the workflow:
which words each user is learning already sit in Supabase, and a migration
adds views that make them queryable as ordinary rows.

**Nothing in the app changed.** The sync snapshot Woordkast already writes
(`user_state`) holds every word in every deck along with its ladder level and
full practice history — it was just stored as JSON, which is right for syncing
and awkward for analysis. The views unpack that same data. So they need no new
tracking code, they can't drift out of date, and they already cover anyone who
has been practising since before you set this up.

---

## 1. Apply the migration

[`supabase/migrations/20260812093000_word_progress_views.sql`](../supabase/migrations/20260812093000_word_progress_views.sql).
Same two options as the rest of the schema (see [auth-setup.md](./auth-setup.md)):
let the **Supabase GitHub integration** apply it on merge, or paste it into the
**SQL Editor** and hit Run.

Run everything below in the **SQL Editor** — as the project owner you see the
whole cohort. (The views are `security_invoker`, so if a signed-in user ever
queried them from the browser they'd see only their own rows. Your testers
cannot read each other's decks.)

## 2. What you get

| View | One row per | Use it for |
| --- | --- | --- |
| `user_word_progress` | (user, word) in a deck | what each person is learning, and how far along |
| `user_practice_events` | flashcard answer | the raw practice log, with timestamps |
| `user_word_review_stats` | (user, word) | lifetime totals: reviews, correct, wrong, accuracy |
| `survey_candidates` | (user, word) at level 4+ | **the survey shortlist** — mastered or nearly |
| `study_participants` | user | cohort health during the two weeks |

### How "mastered" is defined

Words climb a 0–6 ladder — a correct answer moves up one level, a wrong answer
down one — with reviews scheduled 1 → 3 → 7 → 14 → 30 → 90 days apart
(`src/lib/learningEngine.ts`). The `tier` column names the same bands the app
shows on its mastery bars:

| `level` | `tier` | in the app |
| --- | --- | --- |
| 6 | `mastered` | "Mature" |
| 4–5 | `strong` | "Strong" |
| 1–3 | `learning` | "Learning" / "Getting there" |
| 0 | `new` | not practised yet |

`survey_candidates` is everything at level 4 or above — "mastered, or near to
that". A word reaches level 4 after four correct answers with no slips, so its
last scheduled gap was 14 days: the app is claiming these should still be known
two weeks later, which is exactly the claim your survey tests.

## 3. During the two weeks — is there anything to survey yet?

```sql
select * from public.study_participants order by survey_ready_words desc;
```

`survey_ready_words` is how many questions that person could be asked today.
If it stays at 0 for someone, they aren't practising enough for the survey to
say anything, and that's worth knowing on day 3 rather than day 14.

To put names to the ids (owner-only — `auth.users` is not exposed to the app):

```sql
select u.email, p.*
from public.study_participants p
join auth.users u on u.id = p.user_id
order by p.survey_ready_words desc;
```

Who has gone quiet:

```sql
select u.email,
       p.active_days,
       p.total_reviews,
       date_trunc('day', now() - p.last_review_at) as since_last_review
from public.study_participants p
join auth.users u on u.id = p.user_id
where p.last_review_at is null                      -- never practised at all
   or p.last_review_at < now() - interval '3 days'
order by p.last_review_at nulls first;
```

The `is null` half matters more than the rest of the query: someone who signed
up and never opened a session has no `last_review_at` to compare, so a plain
`<` test drops the very people you most need to chase.

## 4. Day 14 — freeze the snapshot first

Testers keep using the app while your survey sits in their inbox. If you score
against the live views a week later, the levels will have moved and you'll be
grading answers against a question set that no longer exists. So copy the
shortlist into the owner-only `research` schema and work from that:

```sql
create table research.survey_snapshot as
select now() as captured_at, * from public.survey_candidates;
```

(The `research` schema is created by the migration. It is not exposed over the
API and has no grants to `anon`/`authenticated`, which matters here: unlike the
views, a snapshot table is cohort-wide with no row-level security in front of
it.)

## 5. Pick the words to test

The honest shortlist — reached level 4+ **through practice**:

```sql
select * from research.survey_snapshot
where reviews > 0
order by user_id, level desc, last_reviewed_at;
```

> **Why `reviews > 0`:** a word the user flagged as already-known when they
> captured it is created at level 6 with no practice behind it
> (`markAsKnown`). It is "mastered" in the deck and proves nothing about the
> app. Leave those out of the learning claim — though asking a few anyway is a
> decent sanity check on self-assessment.

Ten per person, sampled at random so you're not only testing their oldest or
best words:

```sql
select user_id, dutch, english, tier, level, reviews, accuracy_pct
from (
  select *, row_number() over (partition by user_id order by random()) as pick
  from research.survey_snapshot
  where reviews > 0
) ranked
where pick <= 10
order by user_id, pick;
```

### Add a control set

A recall rate on mastered words means much more next to the same number for
words the app says are *not* learned yet. Pull a few level 1–3 words per
person and mix them into the same survey — same question format, so testers
can't tell which is which:

```sql
select user_id, dutch, 'control' as arm
from (
  select p.user_id, p.dutch,
         row_number() over (partition by p.user_id order by random()) as pick
  from public.user_word_progress p
  join public.user_word_review_stats s
    on s.user_id = p.user_id and s.word_id = p.word_id
  where p.level between 1 and 3
) ranked
where pick <= 5
order by user_id;
```

If mastered words come back at 85% and control words at 40%, the ladder is
doing its job. If they come back the same, it isn't — and that is the single
most useful thing two weeks of testing can tell you.

## 6. Export, and fill in the translations

Download any of the queries above with **Export → CSV**. Note that `english`
is filled in only for words a tester added themselves (those sync their own
translation) — the 14k bundled glosses live in the app, not in Postgres, so
the CSV comes back with the Dutch words and blank meanings.

This script joins the two:

```bash
npm run survey -- candidates.csv survey.csv
```

It fills `english`, `gender`, `example` and `exampleEn` from the bundled
dictionary, leaves any translation the export already had, and prints how many
words it matched. Output is CSV, ready for whatever you're building the survey
in. It also takes a plain list of words, one per line, if you just want to look
some up. Re-running it on its own output is safe.

## 7. After the survey

Load the responses into the same schema and join on `(user_id, word_id)` — the
snapshot is what the questions were drawn from, so the join is exact:

```sql
create table research.survey_responses (
  user_id  uuid    not null,
  word_id  text    not null,
  correct  boolean not null,
  primary key (user_id, word_id)
);
-- then: Table Editor → Import data from CSV
```

Recall by tier, which is the headline number:

```sql
select s.tier,
       count(*)                                  as asked,
       count(*) filter (where r.correct)         as recalled,
       round(100.0 * count(*) filter (where r.correct) / count(*)) as recall_pct
from research.survey_responses r
join research.survey_snapshot s
  on s.user_id = r.user_id and s.word_id = r.word_id
group by s.tier
order by s.tier;
```

And the diagnostic one — where the app's confidence was misplaced:

```sql
select s.dutch, s.level, s.reviews, s.accuracy_pct, s.lapses,
       s.last_reviewed_at, r.correct
from research.survey_responses r
join research.survey_snapshot s
  on s.user_id = r.user_id and s.word_id = r.word_id
where s.tier = 'mastered' and not r.correct
order by s.last_reviewed_at;
```

Every row there is a word the app called mastered and the user had forgotten.
If they cluster on high `lapses` or long gaps since `last_reviewed_at`, the
ladder is promoting words too fast — and you'll have the evidence in hand.

---

## Things worth knowing

- **`reps` vs `reviews`.** `reps` on a deck item is the *current* streak and
  resets to 0 on a wrong answer, so it undercounts the work a word took. Use
  `reviews` / `correct` / `wrong` from `user_word_review_stats` (already joined
  into `survey_candidates`) for totals.
- **Sync lag.** These views read what the app last pushed. Pushes are debounced
  ~1.2s after a change and need the user online, so a tester who practised
  offline this morning shows up whenever their app next syncs. `last_synced_at`
  tells you how fresh each row is; give it a day before drawing conclusions.
- **Words don't disappear.** Sync merges rather than deletes (see
  `cloudState.mergeState`), so a word removed on one device can come back. A
  deck row is "has been learning this", not "has this right now".
- **`is_leech`** flags words answered wrong 4+ times. These are the app's known
  problem cases; they're worth surveying separately rather than dropping.
- **Custom words** (added via Wiktionary search) carry `is_custom_word = true`
  and their own `english`. They test the app differently from bundled
  vocabulary — the user chose them, so motivation is higher.
