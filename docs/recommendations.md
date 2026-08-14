# Recommendations — the open findings, and what to do about them

Every issue still open after [run 04](./studies/run-04-795d03e.md), with a
proposed solution grounded in what comparable apps do. This is a living
document: the runs are frozen records, this is the response to them.

Ordered by what a wrong answer costs the learner.

**Shipped so far:** 3a, 4 and 5, in `42e9350`. Everything else stands.

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

**a. Make the translation editable, before and after saving.** Smallest change,
largest safety gain. On the found-word card, let the gloss be edited in place;
in the deck row, offer Edit alongside Remove.

Implementation note: don't fork the bundled entry. Add an optional
`override?: { english?: string; example?: string; exampleEn?: string }` to
`DeckItem`, and have `resolveEntry` merge it over the dictionary entry. It
rides the existing `cloudState` sync with no schema work, survives dictionary
updates, and keeps the 14k bundle immutable.

**b. Stop showing only the first sense.** `lookupWiktionary` walks the Dutch
definitions and returns on the first usable gloss (`wiktionary.ts:65-81`) —
the rest are already in the response and thrown away. Return up to three and
render a picker. For the bundled dictionary the fix is authoring, not code:
`data/curated.ts` carries one gloss per word, so words with genuinely distinct
senses need a second. Prioritise a **civic Dutch** pass — the vocabulary of
letters, forms and signs (`aanslag`, `termijn`, `beschikking`, `bezwaar`,
`ingang`, `uitrit`, `verzuim`) — rather than the whole 14k.

**c. Capture the sentence the word was met in.** Readlang's model, and the
single highest-value addition to the data. An optional "where you saw it"
field at capture, shown on the flashcard beneath the app's own example. Even
with no sense selection at all, a learner who sees *their* sentence next to
the gloss can tell that "attack" doesn't fit a letter about money. Pairs
naturally with item 2.

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

**a. An "Add from text" screen.** Paste or type any Dutch text; the app splits
it into words and renders them tappable; tapping one looks it up and offers
Add, with the surrounding sentence captured automatically. This is the
highest-value single feature on this list: it makes task 1 native, it removes
the retyping, and it hands item 1c its context for free. It reuses the whole
existing lookup path — only the entry point is new.

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
`searchable = missed && suggestions.length === 0` (`Capture.tsx:69`). That
half is now fixed; the inflection half is not.

**What other apps do.** [Yomitan deinflects before looking anything
up](https://yomitan.wiki/) — converting a conjugated form back to its
dictionary form is the first step, not a fallback, and it runs dozens of local
queries per word to do it.

### Recommendation

**a. Let the online lookup run even when suggestions exist.** ✅ **Shipped in
`42e9350`.** `searchable = missed`; the chips now show alongside the online
result rather than instead of it, and they survive a failed request — which is
exactly when they're the only lead left. `termijn` resolves.

**b. Deinflect before declaring a miss.** Dutch is regular enough for a small
rule-based stemmer: plural `-en`/`-s`, diminutive `-je`/`-tje`, comparative
`-er`, superlative `-st`, past participle `ge-…-d`/`-t`/`-en`, verb endings
`-t`/`-en`, plus the doubled-consonant and `aa→a` vowel alternations
(`huurders → huurder`, `maatregelen → maatregel`, `gestegen → stijgen` needs a
small irregular list). Generate candidates, test each against the dictionary,
and when one hits, **say why**: "huurders → **huurder** (plural)". That turns
today's guesswork into a lesson, which is what this app is for.

Build it as a pure function beside `suggestWords`, unit-tested like
`learningEngine` — same shape as the code already there.

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

**Send a 6-digit code instead of a link.** In Supabase this is a template
change — use `{{ .Token }}` in place of `{{ .ConfirmationURL }}` and omit
`emailRedirectTo`, then verify with `verifyOtp` ([docs](https://supabase.com/docs/guides/auth/auth-email-passwordless)).
The user never leaves the app: they read six digits off a notification and
type them into the screen they're already on. Note that code length is a
server setting, so don't hard-code a six-character input mask.

For the pilot specifically, the simpler option is to **turn email confirmation
off** for the cohort and rely on the password. Fewer moving parts during a
14-day study, and it removes the pre-step entirely.

Worth raising but **not** recommending: letting people try the app before
making an account. The hard gate is a deliberate product decision, and
reopening it is a bigger conversation than this list.

---

## Suggested order

| | Item | Effort | Why here |
| --- | --- | --- | --- |
| ✅ | **3a** — let the online lookup run alongside suggestions | One line | Shipped `42e9350` |
| ✅ | **5** — stay on the capture screen after adding | Small | Shipped `42e9350` |
| ✅ | **4** — Show translation before the grade buttons | Small | Shipped `42e9350` |
| 1 | **1a** — editable translations, via a `DeckItem.override` | Small–medium | The safety net under every wrong gloss |
| 2 | **2a** — Add from text | Medium | Makes task 1 native, and feeds context into 1c |
| 3 | **3b** — Dutch deinflection before "not found" | Medium | Pure, testable; converts misses into explanations |
| 4 | **1c** — capture the sentence the word was met in | Medium | Best long-term answer to the wrong-sense problem |
| 5 | **1b** — multiple senses (Wiktionary picker, then civic-Dutch authoring) | Medium code, ongoing data | The real fix, but the data pass is never "done" |
| 6 | **6** — OTP code instead of a confirmation link | Small, mostly config | Or just disable confirmation for the pilot |

The three cheap ones are done. What remains is the wrong-sense problem and the
reading route, which is where the value now is: **1a** is the next to take, and
**1b** is the one to start authoring in the background, because it is the only
item whose cost is measured in words rather than commits.

---

## Sources

- [Readlang — features](https://readlang.com/features) (saving words with their sentence)
- [Yomitan](https://yomitan.wiki/) and [its language features](https://github.com/yomidevs/yomitan/blob/master/docs/development/language-features.md) (deinflection before lookup)
- [Anki manual — Studying](https://docs.ankiweb.net/studying.html) (Show Answer, then grade)
- [Web Share Target API](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target) (and its install requirement)
- [Supabase — passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless) (OTP instead of magic link)
