# Recommendations — the open findings, and what to do about them

Every issue still open after [run 04](./studies/run-04-795d03e.md), with a
proposed solution grounded in what comparable apps do. This is a living
document: the runs are frozen records, this is the response to them.

Ordered by what a wrong answer costs the learner.

**Shipped so far:** 3a, 4 and 5 in `42e9350`; 1b in `2e45d52`; 1a and 3b in
`8864c50`; 7a, 7b, 2a, 1c and 6 in `20e0703`. Nothing open from this list.

---

## 1. A wrong meaning arrives looking exactly like a right one

**The finding.** Three of seven words off a municipal letter came back wrong,
and the two that matter arrive with an example sentence demonstrating the
wrong meaning: `aanslag` as "attack / assault", illustrated with an embassy
attack, when the letter means a tax assessment. `bezwaar`, which is correct,
renders identically. A saved word cannot be edited.

**Why it's the top item.** Every other issue costs the user time. This one
costs them the thing they came for — and it is invisible, so it survives the
whole 14-day pilot and lands in `survey_candidates` as a word the app claims
they mastered.

**What other apps do.** [Readlang](https://readlang.com/features) saves every
word *together with the sentence it appeared in*, and the flashcard later
shows that original sentence with a link back to the source. LingQ offers a
list of candidate translations to choose from, and lets you type your own.
[Yomitan](https://yomitan.wiki/) stacks every dictionary entry it has rather
than picking one. The shared principle: **the app proposes, the learner
disposes** — and context, not confidence, is what makes a gloss checkable.

### Recommendation — three layers, in this order

**a. Make the translation editable, before and after saving.** ✅ **Shipped in
`8864c50`.** The deck row's expanded view gained an **Edit translation** link
opening a small form (translation + both example fields); saving reuses 1b's
exact override mechanism (`addCustomEntry`/`resolveEntry`) — no `DeckItem`
schema change, no fork of the bundled entry, same sync.

Fixing this surfaced a real bug in that shared mechanism: the "does this match
the bundled default" guard only compared the translation, so an edit that
changed *only* the example was silently discarded as a false no-op — caught by
testing exactly that case in a browser. The guard now compares translation and
both example fields against a proper resolved default (a new
`resolveBundled()` helper, factored out of `resolveEntry`), not the
permanently-empty raw dictionary entry. Editing a word back to precisely its
default now also removes the stale override rather than leaving it pinned.
Verified across a page reload and a practice session, and re-verified that 1b's
picker still works correctly after the refactor.

**b. Stop showing only the first sense.** ✅ **Shipped in `2e45d52`.**
`lookupWiktionary` now collects every distinct definition across every
part-of-speech section (capped at 5) instead of returning on the first —
those extra senses were already in the response and were being thrown away.
For the bundled dictionary, a new small hand-authored overlay
(`src/data/senses.ts`) carries additional senses for `aanslag`, `weken` and
`uiterlijk` (the last newly added to `data/curated.ts`, along with `termijn`,
closing two run-04 gaps directly) — a **civic Dutch** starter set, not a bulk
pass over the other ~14,190 words, exactly as scoped here.

The capture screen renders every sense as its own card with its own Add
button whenever a word has more than one (`SenseCard.tsx`); picking one had
to survive past the moment of picking it, so `resolveEntry` now checks the
custom-word store *before* the bundled dictionary rather than after, and
`addCustomEntry` writes an override whenever the saved gloss differs from the
bundled default — reusing the deck's existing sync wholesale, no schema
change. Verified in a browser: picking the non-default sense for `aanslag`
updates the deck immediately and survives a full page reload.

Extending the civic-Dutch list is now just adding an entry to
`src/data/senses.ts` — no build step, no code change.

**c. Capture the sentence the word was met in.** ✅ **Shipped in
`20e0703`**, as part of Add from text (item 2a) — that's where a source
sentence exists unambiguously, so `metIn` is set automatically there and
nowhere else (no manual field was added to the ordinary capture screen; see
2a). `DictionaryEntry.metIn` rides the same custom-entry override sync as 1a's
translation edits and 1b's sense picks — no new schema, no separate storage.
Shown on the deck row's expanded view ("Where you met it", above the app's
own "In context" example) and on the flashcard's front face, beneath the
app's own Dutch example. Verified in a browser: tapping a word out of pasted
text captures its actual sentence, and it survives to both the deck row and
the flashcard.

**Also worth one line of copy:** when a gloss came from the online fallback it
has no gender and no example, and it currently just looks thinner than the
others for no stated reason. Say so — "from the online dictionary" — so the
difference reads as provenance rather than damage.

---

## 2. Nothing carries reading into the app

**The finding.** The task is "read this article and capture a word you don't
know", and there is no reader, no paste-a-text, no share target, no clipboard
prompt. The participant reads in another tab and retypes from memory — a word
they cannot yet read.

**What other apps do.** Readlang ships a web reader and a browser extension;
LingQ imports the text and you read inside the app; Kindle's vocabulary
builder is built into the reader. All three own the reading surface, because
that is where the words are.

### Recommendation

**a. An "Add from text" screen.** ✅ **Shipped in `20e0703`**
(`src/screens/AddFromText.tsx`). Paste or type any Dutch text; a pure
tokenizer (`tokenizeText.ts`) splits it into sentences and tappable word
tokens; tapping one runs it through the same resolution pipeline as the
capture screen — deinflection, the sense picker, suggestions, all of it —
now shared via an extracted `useWordLookup` hook and a shared
`WordLookupResult` component, so the two screens can never drift apart on
what a resolved word looks like. Adding a tapped word also captures the exact
sentence it came from (item 1c), automatically. Reached from the capture
screen's blank state ("Or add several words from something you're reading
→"). Verified in a browser end to end: paste two sentences, tap a word in
the second one, add it, and both its `metIn` sentence and its dictionary
example show up distinctly on the deck row and the flashcard.

**b. A paste affordance on the capture screen.** When Add a word opens, offer
a **Paste** button rather than reading the clipboard unprompted (a silent read
needs permission and feels like surveillance). One tap instead of retyping.

**c. Share-to-Woordkast — later, and know the catch.** The
[Web Share Target API](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)
would put Woordkast in Android's share sheet, but it requires a PWA manifest
**and** the user installing the app to their home screen first. That
contradicts what the study protocol promises participants ("nothing to
install"), so it can't carry the pilot. Worth doing after, as a convenience
for committed users — not as the answer to this finding.

---

## 3. Inflected words miss, and a bad guess hides the real answer

**The finding.** Article and letter Dutch is inflected; lookup is exact-match
on the lemma. `huurders`, `maatregelen`, `gestegen`, `toegenomen`, `afspraken`,
`duurder`, `verboden` all miss. Worse, a near-match *suppresses* the online
lookup: `termijn` offered `terwijl` and never looked the real word up, because
`searchable = missed && suggestions.length === 0` (`Capture.tsx:69`). Both
halves are now fixed.

**What other apps do.** [Yomitan deinflects before looking anything
up](https://yomitan.wiki/) — converting a conjugated form back to its
dictionary form is the first step, not a fallback, and it runs dozens of local
queries per word to do it.

### Recommendation

**a. Let the online lookup run even when suggestions exist.** ✅ **Shipped in
`42e9350`.** `searchable = missed`; the chips now show alongside the online
result rather than instead of it, and they survive a failed request — which is
exactly when they're the only lead left. `termijn` resolves.

**b. Deinflect before declaring a miss.** ✅ **Shipped in `8864c50`**
(`src/lib/deinflect.ts`). A rule-based stemmer tries plural `-en`/`-s`
(with the `afspraken → afspraak` vowel-doubling spelling change), comparative
`-er`/`-der`, diminutive `-je`/`-tje`, and weak past participles `ge-…-d`/`-t`
back to their `-en` infinitive (with the `gebeld → bellen` consonant-doubling
change) — each candidate tested against the real dictionary, so a rule that's
wrong about Dutch morphology just produces a candidate nothing matches and
never surfaces. A short hand-authored list
(`src/data/irregularVerbs.ts`, same pattern as `senses.ts`) covers the ablaut
participles no suffix rule derives: `gestegen → stijgen`,
`toegenomen → toenemen`, `verboden → verbieden`. A hit says why —
"huurders" → **huurder** (plural)" — and takes priority over both the fuzzy
suggestions and the online lookup, since it's a grammatical match rather than
a guess.

Pure function, unit-tested with a fake dictionary (15 cases, including that a
misfiring rule must fail silently rather than propose a wrong answer) — same
shape as `learningEngine.ts`. Verified against the real bundled dictionary in
a browser: every word from the original run-01 finding now resolves with an
explanation.

**c. Stop offering distant guesses.** `gestegen → gisteren` is edit distance 2
with no shared prefix and no shared meaning. Require a shared prefix for
distance-2 candidates, and rank by frequency. Three confident wrong answers
are worse than none.

---

## 4. You can grade a card without ever seeing the answer

**The finding.** Both **Still learning** and **I knew it** are live before the
card is flipped, and nothing states the intended order — while the eyebrow
asks "Do you know this word?", which invites answering immediately.

**What other apps do.** [Anki shows only the question, with a single **Show
Answer** button](https://docs.ankiweb.net/studying.html); the grade buttons do
not exist until the answer is revealed. The sequencing is the pedagogy —
retrieval first, then honest self-assessment.

### Recommendation

✅ **Shipped in `42e9350`.** A single full-width **Show translation** before
the flip, the grade pair after it. Tap count is unchanged (the flip was
already a tap), the ambiguity is gone, and the card stops inviting a grade for
a word the user hasn't tried to recall. Tapping the card still flips it — this
is the same gesture given a label.

---

## 5. Adding several words in a row costs four taps each

**The finding.** Every save navigates to the deck, so capturing a second word
means finding the + again. The task literally asks for "three words".

**What other apps do.** Anki's Add dialog stays open after adding, ready for
the next note. Quizlet's set editor keeps a running list of rows.

### Recommendation

✅ **Shipped in `42e9350`.** Adding keeps you on the capture screen, which
confirms the save ("**huurder** added to your deck", with a running count from
the second word on), clears the field, and refocuses it. **Undo** takes the
word back out; **View your deck** goes where the old flow dumped you, when
that's actually what you wanted. Two taps per word instead of four.

The appbar's back chevron stayed as the exit rather than gaining a **Done** —
it was already there and already leaves.

---

## 6. Sign-up sends the user out to their inbox and back

**The finding.** Creating an account can end at "check your email", which
means leaving the app, opening mail, following a link, and logging in again.
It's well-signposted since run 03, but the interruption is structural.

### Recommendation

**Send a 6-digit code instead of a link.** ✅ **Shipped in `20e0703`.**
Sign-up's "check your email" step now has a code-entry form (`Auth.tsx`) that
calls a new `verifySignupOtp` (`src/lib/auth.ts`, wrapping Supabase's
`verifyOtp` with `type: "signup"`); a successful verify returns a session
directly, so there's no separate "now log in" step the way the link flow
needed one. The fallback copy still covers a user who opens the link instead
("Opening it confirms your account the same way — come back here and log in
afterward"), since the link keeps working either way. The resend button is
unchanged.

This only *displays* as a 6-digit code once the Supabase project's
confirmation email template is switched from `{{ .ConfirmationURL }}` to
`{{ .Token }}` — a one-time dashboard change, documented in
[`docs/auth-setup.md`](./auth-setup.md), that this repo can't make on the
user's behalf (it isn't in source control). Until that switch is made, the
email still shows a link; `verifySignupOtp` works correctly regardless, it
just has nothing to verify against until the template points at a token.
Verified in a browser against a stubbed Supabase auth API: sign-up reaches
the code screen, a wrong code surfaces the server's error text, and the
right code signs the user straight into the app.

For the pilot specifically, the simpler option is still to **turn email
confirmation off** for the cohort and rely on the password. Fewer moving
parts during a 14-day study, and it removes the pre-step entirely — this
remains true even with the code in place, if the template change isn't worth
making before the study starts.

Worth raising but **not** recommending: letting people try the app before
making an account. The hard gate is a deliberate product decision, and
reopening it is a bigger conversation than this list.

---

## 7. Deinflection can resolve to the wrong real word

**The finding.** [Run 05](./studies/run-05-f4f6ecd.md), testing against a real
pasted news article, found this inside 3b itself: `sloten` (ditches) resolves
to `slot` (lock), and `beken` (streams) resolves to `bek` (beak/mouth) — both
with full confidence, no hedge. Dutch pluralises `sloot`→`sloten` and
`slot`→`sloten` identically (same for `beek`/`bek`→`beken`), and the bundled
dictionary contains all four singulars. `deinflect.ts` generates the
unmodified-strip candidate before the vowel-doubled one and returns on the
**first** real dictionary hit — so it stops at the wrong word before ever
trying the right one. This is the exact failure shape run 01 and run 04 both
found, now reproduced inside the mechanism built to prevent it.

Separately, `aanhoudende` (adjective agreement `-e`) isn't covered by any
current rule, and fell through to the fuzzy suggestion list instead — which
happened to land correctly this time, but isn't a rule doing its job on
purpose.

**What other apps do.** The same principle as 1b applies here, not a new one:
[Yomitan doesn't pick a definition, it stacks every one it finds](https://yomitan.wiki/)
and lets the reader judge from context. A deinflector that finds two
independently valid lemmas is in exactly the situation 1b was built for.

### Recommendation

**a. Don't stop at the first hit — collect every real candidate.** ✅
**Shipped in `20e0703`.** `deinflect` now returns `Deinflection[]`
instead of `Deinflection | null`, collecting every rule's real candidate
instead of returning on the first match. Exactly one candidate still behaves
as before — a single explanatory notice. More than one is no longer asserted
as a single answer: a new `DeinflectionCard` (visually identical to
`SenseCard`, same "which one did you mean" pattern as 1b) renders each
candidate with its own gender, gloss, example and **Add this word** button —
"sloten" now offers both **slot** (lock) and **sloot** (ditch); "beken" both
**bek** (mouth) and **beek** (stream). Unit-tested (`deinflect.test.ts`)
including a regression test for exactly this run-05 case, and a precedence
test proving a more specific rule's single hit is never joined by a decoy
from a less specific one. Verified in a browser: both candidates render with
correct data for `sloten` and `beken`, and saving either one persists the
right word to the deck.

**b. Add an adjective-agreement rule.** ✅ **Shipped in `20e0703`.** A
new `AGREEMENT_RULE` strips a bare trailing `-e` (plus the vowel-doubling
spelling change, e.g. a stem ending in a long vowel), tried only as a
fallback once every more specific rule has already failed to match anything
— it's the least specific pattern here, since almost any word can end in
`-e`. `aanhoudende → aanhoudend` (and `kleine → klein`, verified in a
browser) now resolve this way, with an explicit "adjective agreement"
explanation, instead of by luck through the fuzzy suggestion list.

---

## Suggested order

| | Item | Effort | Why here |
| --- | --- | --- | --- |
| — | ✅ **3a** | — | Shipped `42e9350` |
| — | ✅ **5** | — | Shipped `42e9350` |
| — | ✅ **4** | — | Shipped `42e9350` |
| — | ✅ **1b** | — | Shipped `2e45d52` — extending `senses.ts` is now ongoing, not a project |
| — | ✅ **1a** | — | Shipped `8864c50` — surfaced and fixed a real bug in 1b's shared override guard |
| — | ✅ **3b** | — | Shipped `8864c50`, revised by 7a — every original run-01 miss resolves, but see 7 |
| — | ✅ **7a** | — | Shipped `20e0703` — the run-05 wrong-answer bug, fixed by reusing 1b's picker pattern |
| — | ✅ **2a** | — | Shipped `20e0703` — Add from text, feeding item 1c its context |
| — | ✅ **1c** | — | Shipped `20e0703` — sentence capture, automatic, via Add from text only |
| — | ✅ **7b** | — | Shipped `20e0703` — the adjective-agreement gap 7a's fix didn't cover |
| — | ✅ **6** | — | Shipped `20e0703` — OTP code in-app; needs a one-time Supabase email-template change (`docs/auth-setup.md`) to display as a code rather than a link |

All eleven are done. Everything still open is out of this list's scope: item
3c (stop offering distant fuzzy guesses) and item 2's other two sub-items
(paste affordance, share target) were never picked up in the "Suggested
order" above and remain candidates for a future run if a study surfaces them
as live problems again.

---

## Sources

- [Readlang — features](https://readlang.com/features) (saving words with their sentence)
- [Yomitan](https://yomitan.wiki/) and [its language features](https://github.com/yomidevs/yomitan/blob/master/docs/development/language-features.md) (deinflection before lookup)
- [Anki manual — Studying](https://docs.ankiweb.net/studying.html) (Show Answer, then grade)
- [Web Share Target API](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target) (and its install requirement)
- [Supabase — passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) (OTP instead of magic link)
