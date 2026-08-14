# Run 05 — synthetic first-run walkthrough

**Build `f4f6ecd` · 14 August 2026 · frozen**

Two things changed the shape of this run. First, task 1 finally uses a real
article instead of a stand-in: `nos.nl` stayed unreachable from this test
environment across every attempt (eight further Dutch domains — `nu.nl`,
`ad.nl`, `telegraaf.nl`, `volkskrant.nl`, `nrc.nl`, `parool.nl`,
`nl.wikipedia.org`, even the government's own `rijksoverheid.nl` — were all
blocked the same way, so this is environmental, not one publisher), so the
user pasted the article's text directly: an RTL Nieuws piece on record heat
and drought-driven "sproeischaamte" ("sprinkler shame" — the self-consciousness
of watering a garden during a drought). Second, this run adds four scoped
scenarios on top of the standard three tasks, written as the client's own
user stories.

Build `f4f6ecd` includes every fix from runs 01–04's follow-up work: 3a, 4, 5,
1b, 1a, and 3b are all shipped. This run's job is to see what four rounds of
fixes actually bought — and it found a new bug inside one of them.

---

## Scenario tests

### "As a new user, I want to register and create my first deck"

Walked fresh: create an account → land on "Add your first word" → capture two
words. Deliberately picked one multi-sense word and one inflected form, to
see whether a brand-new account gets the same protections as a returning one.

| Step | What happened | |
| --- | --- | --- |
| Register, land on empty dashboard | Clean, per run 03's fixes. | ✅ |
| First capture: `aanslag` | The sense picker (1b) appears on the very first word a new user ever adds — "attack / assault" and "tax assessment / bill" both offered, neither auto-selected. | ✅ |
| Second capture: `huurders` | Deinflection (3b) resolves it immediately: *"huurders" → **huurder** (plural)*. | ✅ |
| Deck afterward | Both words show correctly resolved content. | ✅ |

**Verdict:** onboarding is solid, and a first-time user gets the full benefit
of 1b and 3b with no special-casing needed.

### "As a Google account user, I want to log in and continue my practice" / "...add a new word" / "...run flashcard"

**What this run can and can't verify.** Completing a real Google sign-in
needs a live human, a real Google account, and possibly 2FA — no synthetic
walkthrough can drive that consent screen, here or anywhere. What *is*
verifiable, and what actually matters for these three stories, is everything
downstream of authentication: does a Google-sourced session behave like any
other once it exists? Supabase represents every provider behind the same
session object, so the honest test is whether the app's own code branches on
provider anywhere it shouldn't. It doesn't — confirmed by simulating an
authenticated Google session (a signed token landed the way a real OAuth
redirect lands one, with a pre-existing synced deck behind it) and driving
the three stories against it.

| Story | What happened | |
| --- | --- | --- |
| Continue practice | Dashboard correctly shows the pulled deck's due count ("1 word ready to review") from a simulated prior sync — the merge-on-login path (`cloudState.ts`) runs the same for any provider. Practice session completes normally. | ✅ |
| Settings shows the account | Google's email renders correctly in the account row; nothing assumes an email/password identity. | ✅ |
| Add a new word | `weken` triggers its sense picker exactly as it would for anyone — no provider-specific path exists to diverge. | ✅ |
| Run flashcard | A second session immediately after adding a word picks the new word up with no re-login. Streak climbed to "🔥 2-day streak" correctly, computed from the synced practice history. | ✅ |

**Verdict:** nothing about being a Google user changes the experience once
signed in, which is exactly what should be true. The one thing this run
cannot close out is the literal OAuth handshake — that needs a real tester
with a real account.

---

## Task 1 — capture from reading (the real article)

*RTL Nieuws, 14 August 2026 — on Dutch discomfort with a summer of record
heat, and the self-consciousness ("sproeischaamte") of watering a garden
during the drought.* Words below are exactly what a reader would meet in it;
only short fragments are quoted for context, not the article itself.

| Word met in the article | What the app gave | |
| --- | --- | --- |
| `sproeischaamte` — the article's own coinage | No local or online result (Wiktionary unreachable here, same limitation as every prior run). Correctly recognised as unknown rather than guessed at. | ⚠️ env |
| `recordhitte` | Same — correctly falls through to an online attempt this environment can't complete. | ⚠️ env |
| `huishoudens` — "bijna alle huishoudens" | *"huishoudens" → **huishouden** (plural)*. Correct. | ✅ |
| `kostbaarder` — "water is kostbaarder dan ooit" | *"kostbaarder" → **kostbaar** (comparative)*. Correct. | ✅ |
| `daadwerkelijk` | Found directly, correct gloss. | ✅ |
| `aanhoudende` — "aanhoudende droogte" | Deinflection doesn't cover adjective agreement (-e), so this fell to the fuzzy suggestion list instead — which happened to land on the right word (`aanhoudend`) via a 1-edit distance. Right answer, by a different and less certain route than it should have taken. | ⚠️ |
| **`sloten`** — "sloten, beken en kanalen" (ditches, streams and canals) | ❌ **Confidently wrong.** *"sloten" → **slot** (plural)* — "lock." The word means *ditches* here. | ❌ |
| **`beken`** — same phrase | ❌ **Confidently wrong**, the same way. *"beken" → **bek** (plural)* — "beak / mouth." The word means *streams*. | ❌ |

### The finding: deinflection can be as confidently wrong as the thing it replaced

`sloten` is genuinely ambiguous in Dutch — it's the plural of both **slot**
(lock) and **sloot** (ditch), which happen to share a plural apart from a
vowel-length spelling change. `beken` has the identical shape: plural of both
**bek** (beak/mouth) and **beek** (stream). The bundled dictionary contains
all four singular forms. `deinflect.ts` generates the plain-strip candidate
before the vowel-doubled one (`slot` before `sloot`; `bek` before `beek`), and
returns on the **first** real dictionary hit — so it stops at the wrong word
before ever trying the right one, with no signal that a second, equally valid
candidate existed.

This is the same failure shape run 01 and run 04 both found — a wrong meaning
delivered with full confidence — now reproduced *inside the mechanism 3b built
specifically to prevent exactly that.* The finding isn't that 3b failed; the
suggestion list it replaced would have done worse (`sloten` is edit-distance 2
from several unrelated words, none of them `sloot`). It's that "first real
dictionary hit" was never the right acceptance criterion — "only real
dictionary hit" was, and `deinflect` doesn't yet know when it has more than one.

**Verdict on task 1:** every genuinely regular inflection in real running text
resolved correctly and explained itself. The one real gap — irregular vowel
alternation colliding with an unrelated real word — is narrow but not rare:
`sloten`/`beken` are ordinary, common plurals, not edge-case vocabulary.

---

## Task 2 — capture from a letter

Re-walked the same seven words from run 04, now against every shipped fix.

| Word | Then (run 04) | Now |
| --- | --- | --- |
| `aanslag` | Only "attack / assault" | Both senses offered; picker required a tap |
| `weken` | Only "to soak" | Both senses offered |
| `uiterlijk` | Not in the dictionary at all | Both senses offered natively |
| `termijn` | "Did you mean terwijl" (wrong) | Resolves directly, added to the dictionary |
| `bezwaar` | Correct, unremarkable | Unchanged, still correct |
| `huurtoeslag`, `verkeersbord` | Online-lookup failure (environment) | Same environment limitation, unchanged |

**Verdict:** every wrong-sense finding from run 04 that this task exists to
catch is closed. The two environment-blocked words are exactly as before —
not an app issue.

## Task 3 — practice

Reveal-before-grade (4), the progress counter holding across a miss (fixed
after run 02), and the summary screen's dual exit (fixed after run 03) all
re-confirmed on the current build with no regressions.

---

## New this run

| Finding | Detail |
| --- | --- |
| **Deinflection ambiguity** (above) | The headline finding. `sloten`/`beken` resolve to the wrong lemma with full confidence. Likely not limited to these two — any inflected form whose stripped-and-doubled candidates are *both* real dictionary words is exposed the same way. |
| **Adjective agreement isn't deinflected** | `aanhoudende` (from `aanhoudend`) falls to fuzzy suggestions rather than 3b's rule set, and got lucky on the edit distance. A `-e` agreement-ending rule is the natural next addition, same shape as the existing rules. |

## Still open

Carried forward, unchanged this run: 2a (Add from text), 1c (capture the
source sentence), 6 (OTP instead of an email link) from
`docs/recommendations.md` — plus the two new findings above.

---

## Revised task script

Unchanged from run 04's script for tasks 1–3. The scenario tests above are
additions, not scripted replacements — they were written and run once for
this build rather than folded into the standing three-task script, since two
of the four assume state (an existing account, a Google identity) the
standard script doesn't set up. If Study 2 wants to test the Google path with
real participants, it needs participants who already have a Google account
they're willing to use — the walkthrough here only proves the app doesn't
mishandle one once it's signed in, not that the sign-in itself is smooth.

---

## Explicitly out of scope for this report

No completion rate, no task timing, and no usability or satisfaction
judgement. This run only validates that the script and happy path are
logically coherent. Real friction is measured in Study 2. The Google OAuth
handshake itself is explicitly out of scope for a synthetic walkthrough,
noted above, not silently skipped.
