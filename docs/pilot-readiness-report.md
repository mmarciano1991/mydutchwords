# App user-testing readiness report

**Build `b9b5303` · 14 August 2026**
**Resolution pass · 14 August 2026, same day — see the note below each fixed
item and the updated decision table (§11). Second pass, same day: C1 and C2
— initially left as written proposals — are now applied too, per follow-up
instruction; see their entries in §3.**

> **Note on this pass.** H1's fix was meant to follow a Figma redesign at
> `node-id=62-8`, but no Figma MCP connection was available in this session
> — `get_design_context`/`use_figma` weren't reachable, so the design
> couldn't actually be read. H1 below is a **computed-contrast stopgap**,
> not the redesign: same layout, a darker (already-in-palette) color for the
> inactive tab label. **Compare it against the real Figma file and tell me
> if it needs to match more than just the contrast ratio** — spacing, icon
> style, or anything else the redesign changed. Every item marked "Fixed"
> below (now including C1 and C2) is in the working tree, unstaged, not
> committed.

Commissioned ahead of the 14-day pilot described in
[`docs/pilot-survey.md`](./pilot-survey.md), to catch anything a real
tester would hit that the synthetic walkthroughs
([`docs/studies/`](./studies/)) and the shipped recommendation list
([`docs/recommendations.md`](./recommendations.md)) don't cover — chiefly
accessibility and a few code-level correctness/performance checks neither of
those exercises the app for.

## How this was produced, and what it can't tell you

This pass had no browser-automation tool available — no way to click through
the running app, render a real page, or drive a real screen reader. Two
methods were combined instead, and every finding below says which one
produced it:

- **Behavioral flows** — traced from [`src/App.tsx`](../src/App.tsx)'s state
  machine and cross-checked against the five existing synthetic walkthroughs
  (`docs/studies/run-01` through `run-05`), which *did* drive the app,
  character-by-character, against real and near-real input. Where this report
  and those runs cover the same ground, the runs are the primary evidence;
  this report doesn't re-litigate what they already settled.
- **Static code audit** — every screen, shared component, and the full CSS/
  design-token file read directly, for semantic HTML, ARIA usage, keyboard/
  focus handling, label association, and WCAG contrast math computed from the
  actual hex values in [`tokens.json`](../src/styles/tokens/tokens.json).

**What that means for confidence.** Contrast ratios, missing labels, and
markup structure are things static analysis gets right — the math and the
DOM shape don't lie. What it cannot confirm: how any of this actually
renders, whether a real screen reader (VoiceOver, TalkBack, NVDA) announces
it the way the spec predicts, how it feels on a real phone on real mobile
data, or whether the pilot's actual Supabase project is configured the way
[`docs/auth-setup.md`](./auth-setup.md) assumes. Section 9 lists every one of
those gaps explicitly — they are the highest-value thing for a human to check
before real participants arrive, precisely because nothing here could check
them.

---

## 1. Executive summary

The app is **functionally sound and code-verified working** — production
build succeeds clean, all 62 unit tests pass, and every finding from the five
prior synthetic walkthroughs is either shipped (11/11 items in
`recommendations.md`) or a deliberately deferred, documented trade-off. No
new functional dead-ends were found in this pass.

The gap between "ready for a synthetic walkthrough" and "ready for a real
14-day pilot with real accounts on real phones" is **accessibility and a
few unverified production dependencies**, not app logic:

**Update, two resolution passes later (same day):** every Critical and High
item found — the flashcard silencing itself to screen readers, the disabled
pinch-zoom, the tab-bar and word-gloss contrast failures, the oversized
critical-path bundle — is now fixed in the working tree (§3, §4, §11), plus
four of five Medium/Low items. Nothing has been committed. What's below is
the original list, kept as written since it's still the accurate record of
what was *found*; each item now also carries a "✅ Fixed" note showing what
changed and, where relevant, what still can't be verified without a real
device.

- One **critical** accessibility defect made the core practice loop
  effectively silent to a screen-reader user — **fixed** (§3, §6).
- The bottom tab bar's inactive-state text failed WCAG contrast by more than
  2×, and the viewport meta tag disabled pinch-zoom app-wide — both
  **fixed** (§3, §4, §6).
- The single riskiest **untested** path is still the online-dictionary
  fallback (Wiktionary): every synthetic run to date, and this pass, hit the
  same environment network block against it. It has never actually been
  watched succeed or fail against a live response — this one needs a human
  on an unblocked network, not code, and is still open (§9).
- Whether the pilot's actual Supabase project has the manual dashboard
  configuration `auth-setup.md` calls for — email template, redirect URLs,
  Google OAuth client, repo secrets — still cannot be verified from this
  checkout and should be confirmed by hand before inviting testers (§9).

What's left before a pilot: the real-device/screen-reader checks §9 lists
for every fix below (code correctness isn't the same as confirmed behavior),
the Wiktionary live test, and the Supabase/deploy configuration check —
none of it is more code changes, all of it needs a human with a phone and
an account.

---

## 2. User flows tested

Traced through code (state machine in `App.tsx` + every screen it renders)
and cross-referenced against the synthetic walkthroughs, which exercised
these live:

| Flow | Code trace | Live walkthrough evidence |
| --- | --- | --- |
| Onboarding (Welcome → sign up → OTP/email confirm → empty dashboard → first capture) | ✅ | `run-05` scenario 1, `run-03` |
| Log in (returning user) | ✅ | `run-01`–`run-05` |
| Forgot password → email link → set new password → "Not now" escape | ✅ | not live-tested (needs a real inbox) |
| Capture a word — typed, all 5 result states (found / not found / ambiguous deinflection / multi-sense / already in deck) | ✅ | `run-01`–`run-05`, incl. real article text in `run-05` |
| Add from text — paste, tokenize, tap, capture with source sentence | ✅ | `run-05` (2a shipped after that run) |
| Practice — flip, grade, in-session recycle on miss, session report | ✅ | `run-01`–`run-05` |
| "Continue to next batch" / "Review missed words" / back to dashboard | ✅ | `run-03`, `run-05` |
| Warm-up ("Practice ahead") — ungraded, schedule untouched | ✅ | not live-tested |
| Deck (Browse) — search, expand row, edit translation/examples, remove | ✅ | `run-05` (edit shipped after) |
| Settings — account row, sign out, counts | ✅ | `run-05` scenario (Google account) |
| Sign-out → straight back to sign-in (not Welcome) | ✅ | not live-tested |
| Cloud sync — pull + merge + push on login, debounced push while active | ✅ (`cloudState.ts`, `useCloudSync.ts`) | `run-05` (simulated session only — see §9) |
| Google OAuth handshake itself | — | explicitly out of scope for every synthetic run (§9) |

---

## 3. Critical issues

### Functional
None found in this pass. (The 5 synthetic runs' functional dead-ends are
all closed — see `recommendations.md`.)

### UX
None at Critical severity. See §4/§5 for High/Medium UX items.

### Accessibility

**C1 — The flashcard's accessible name hides the entire card from screen
readers.** [`src/screens/Practice.tsx:150-185`](../src/screens/Practice.tsx#L150-L185)

```tsx
<button className="flashcard" onClick={...} aria-label="Flip card">
  <div className="flashcard__inner...">
    <div className="flashcard__face--front">
      {/* Dutch word, gender chip, example sentence, "where you met it" */}
    </div>
    <div className="flashcard__face--back">
      {/* English translation, English example */}
    </div>
  </div>
</button>
```

An explicit `aria-label` on a `<button>` replaces its computed accessible
name entirely — the button's own text content (the Dutch word, its example,
the translation, the "where you met it" sentence) is not exposed as a
separate accessible node once the label wins. A screen-reader user landing on
this control hears **"Flip card, button"** on the front face and the same
thing again after flipping — never the actual word being tested. Practice is
the app's core loop; this makes it effectively unusable for anyone learning
by ear. Confirmed by markup inspection (WCAG 4.1.2 Name, Role, Value /
1.3.1 Info and Relationships) — needs a screen-reader spot check to be
certain a real reader behaves as the spec predicts, but the DOM structure
that causes it is unambiguous.

*Fix direction:* don't put the label on the whole card. Either drop the
`aria-label` and let the card's own content compose the accessible name
(verify it doesn't read as a jumbled run-on across both faces), or split the
flip *gesture* from the flip *control* — keep the whole card tappable for
sighted/touch users, but expose the content as plain readable text and offer
a small, separately-labelled icon button ("Flip card") alongside it for
keyboard/AT users, so the two roles (read the content / trigger the flip)
don't collide on one element.

> **Proposed solution (not applied — see the note at the top).**
>
> **Option A — drop the `aria-label`, let the content speak.** Remove
> `aria-label="Flip card"` from the `<button>`. The accessible name then
> composes from the visible text in DOM order — word, gender chip text,
> example, "where you met it" — which is correct but verbose, and the "Tap to
> flip" hint (`.flashcard__hint`) would read as part of it too unless marked
> `aria-hidden="true"` separately (it's a sighted-only affordance; a screen
> reader user doesn't need to be told to tap what they're already focused
> on). Cheapest change, one line plus one `aria-hidden` addition — but the
> whole card stays a single button, so a screen reader user still can't
> re-read just the word, or just the example, without re-triggering the flip
> each time they revisit it.
>
> **Option B — separate "read the card" from "flip the card" (recommended).**
> Turn `.flashcard` from a `<button>` into a plain `<div>` with an
> `onClick` handler (still fully tappable for touch/mouse users — a
> non-focusable click target is fine when a focusable equivalent exists
> alongside it) holding ordinary, readable text — no wrapping button, no
> name-collapsing. Add a small, explicitly-labelled icon button ("Flip
> card", reusing `IconButton`) positioned near the card for keyboard and
> screen-reader users to trigger the flip on purpose. This is the shape
> Anki's own clients use for "reveal answer": a real, separately-focusable
> action, with the question/answer text itself just being text. It costs one
> new small button in the layout (needs a design decision on placement —
> worth having whoever owns the Figma file for this screen weigh in, same as
> H1) but is the only option that lets a screen-reader user navigate the
> card's content freely — re-reading the example, the translation, whatever
> they want — independent of re-triggering the animation.
>
> Recommend **Option B**. Option A is a smaller diff but leaves the deeper
> problem (content and action fused into one control) in place; Option B is
> the actual fix, Option A is a patch on the way to it.

> ✅ **Fixed — Option A, as chosen** (`src/screens/Practice.tsx`). The
> `aria-label="Flip card"` is gone; both `.flashcard__hint` ("Tap to flip")
> spans are `aria-hidden="true"` as Option A described. One thing added
> beyond exactly what was written above, flagged because it's a real risk
> Option A's description didn't fully close: **both card faces stay in the
> DOM at all times** (the 3D flip needs that), and CSS
> `backface-visibility: hidden` — which is *all* that hides the
> not-currently-showing face — isn't one of the techniques the accessible-name
> computation spec guarantees assistive tech will treat as hidden. Left as
> written, a screen reader could plausibly concatenate **both** faces into
> the button's name on every read — handing over the translation right next
> to the word, defeating the point of a recall quiz. To close that off, each
> face now carries `aria-hidden={flipped}` / `aria-hidden={!flipped}`,
> toggled with the same state that drives the visual flip, so only the
> currently-showing face is ever in the accessible name. Build and all 62
> tests still pass. **Still needs the real screen-reader check §9 already
> calls for** — this closes the specific risk I could see from markup alone,
> but whether VoiceOver/TalkBack actually restrict themselves to the
> non-hidden face the way the DOM now asserts is exactly the kind of thing
> this pass can't confirm without a real device.

**C2 — Viewport meta tag disables pinch-zoom app-wide.**
[`index.html:5-8`](../index.html#L5-L8)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
```

`maximum-scale=1.0` with no `user-scalable` prevents pinch-to-zoom on every
screen, on every browser that honors it. This is a direct WCAG 2.1 SC 1.4.4
(Resize Text, Level AA) failure, and it's global — one line, every page. For
a text-heavy vocabulary app whose whole premise is reading foreign words and
example sentences, this specifically hurts the low-vision users most likely
to need it. *Fix:* drop `maximum-scale=1.0` (and `user-scalable=no`, if it's
ever added); `initial-scale=1.0` alone is enough to set the starting zoom
without blocking the user from changing it.

> **Proposed solution (not applied — see the note at the top).** This one is
> genuinely a one-liner:
> ```html
> <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
> ```
> No other code depends on the removed clause — the app's layout is a
> fixed-max-width "phone" card (`app.css` `.phone`, max 420px) built from
> flexbox and absolute `px` sizing, not something that reflows unusually
> under browser pinch-zoom (which magnifies the rendered viewport rather than
> re-triggering CSS layout the way a text-only "reader mode" zoom would). Low
> risk, but worth the one real-device spot check §9 already calls for — zoom
> to 200% on a phone and confirm nothing critical (the flashcard's grade
> buttons, the appbar's back button) ends up clipped outside the visible
> area. Say the word and I'll apply it — it's the same one-line change
> already named in this report's original §3, just not applied without your
> sign-off per how this pass was scoped.

> ✅ **Fixed.** `index.html`'s viewport meta tag no longer has
> `maximum-scale=1.0`; it now reads
> `width=device-width, initial-scale=1.0, viewport-fit=cover`. Pinch-zoom is
> no longer blocked on any screen. Build and all 62 tests still pass (this
> change touches no JS/TS, so that's expected rather than reassuring) — the
> 200%-zoom clipping spot-check from §9 is still the thing that would
> actually catch a layout problem, and still needs a real device.

---

## 4. High-priority issues

**H1 — Tab bar's inactive-state text fails WCAG contrast by more than 2×.**
`--inactive: var(--ink-300)` (`#a9b0be`) on the cream canvas / white card
computes to **2.05:1 / 2.18:1** — WCAG AA requires 4.5:1 for normal text (the
12px bold tab labels don't qualify as "large text," which would only need
3:1). This is the "Home / Deck / Settings" label under each un-selected tab
— present on every screen, at all times.
[`src/styles/app.css` `.tab`](../src/styles/app.css) ·
[`tokens.json` `inactive`](../src/styles/tokens/tokens.json)

> ✅ **Stopgap fixed** (not the Figma redesign — see the note at the top).
> `tokens.json`'s `inactive` token now points at `var(--mastery-new-weak-medium)`
> (`#5a6b86`, already in the palette — it was the mastery bar's "weak" fill
> color, not a new hex invented for this) instead of `var(--ink-300)`.
> Recomputed: **5.41:1 on white, 5.10:1 on the cream canvas** — clears AA
> with real margin. `--ink-300` itself is untouched, so the search-field
> placeholder text and the mastery-bar track (the other two consumers) don't
> shift. This keeps the tab bar's existing layout and icon set exactly as
> they are — it changes one color value, nothing else — so it's very likely
> *not* everything your Figma redesign at node `62:8` changed. Please
> compare and tell me what else needs to move.

**H2 — `text-faint` (`--ink-500`, `#6b7689`) sits under AA across the app,
including on word meanings.** Computed against the cream canvas: **4.33:1**;
against white cards: **4.59:1** — both below the 4.5:1 minimum (the white-card
case is closer, and passes on some rounding conventions, but is not a
comfortable margin). This single token is reused pervasively: the English
gloss under every Dutch word in the deck list and session report
(`.wordrow__gloss`, `.wordrow-compact__gloss`), section labels ("In context",
"Where you met it"), the sense-picker's part-of-speech tag, and several
captions. Because it's one shared token, this is systemic rather than a
one-off — see §7. It's flagged High rather than Critical because the ratio is
close, not a 2× miss like H1, but it touches core content (what a word
*means*), not decoration.

> ✅ **Fixed.** `tokens.json`'s `ink-500` changed from `#6b7689` to
> `#596373`, exactly the value requested. Recomputed: **5.73:1 on the cream
> canvas, 6.07:1 on white cards** — clears AA with a comfortable margin on
> both surfaces this token is used against (close to AAA's 7:1 on white).
> One token, every consumer listed above fixed at once — nothing else
> changed.

**H3 — The online-dictionary fallback path has never been observed
succeeding or failing against a live response.** Every one of the five
synthetic walkthroughs (`run-01`–`run-05`) hit the same outbound network
block against Wiktionary from their test environment; this pass, working
from source only, inherits the same blind spot. The whole `failed` /
"Try again" branch of `WordLookupResult`
([`src/components/WordLookupResult.tsx:168-177`](../src/components/WordLookupResult.tsx#L168-L177))
and the "not found" branch it's paired with are logically sound on paper but
**genuinely untested against reality**. This is the exact path a pilot
participant will hit constantly — it's the fallback for every word not in
the 14k-word bundled dictionary. See §9 for why this is the single highest-
value manual check before the pilot starts.

> **Advice, as requested (no code to change here — this is a validation gap,
> not a bug).**
>
> 1. **Run the one real test this environment can't.** From a network that
>    can actually reach `en.wiktionary.org`, capture one word outside the
>    14k-word bundled dictionary through Capture, and watch all three
>    branches of `WordLookupResult` fire on purpose: a real success, a real
>    "not found," and — harder to force, but worth trying against a word with
>    unicode/punctuation that might trip the parser — a real `failed` state.
>    Twenty minutes, and it's the single highest-value manual check on this
>    entire list.
> 2. **Record what a real response looks like as a fixture.** Save the raw
>    JSON `lookupWiktionary` gets back for a hit and a miss into a small
>    fixture file, and add a couple of `vitest` cases around
>    `src/lib/wiktionary.ts`'s parsing logic that replay those fixtures
>    through `fetch` mocked with `vi.fn()`. This turns "did it work that one
>    time I checked" into a regression test that fails loudly if Wiktionary
>    ever changes its response shape — cheap to add once real fixtures exist,
>    which is exactly what step 1 produces.
> 3. **Watch it live during the pilot, not just before it.** `lookupWiktionary`
>    already takes an `AbortSignal` and the `failed` state already renders
>    distinctly — the missing piece is visibility. A one-line, privacy-safe
>    client-side counter (successes vs. failures vs. timeouts for online
>    lookups, no word content) surfaced somewhere a facilitator can see it —
>    even just a `console.info` a facilitator greps from a remote-debugging
>    session on day 1 — turns "we hope this works" into "we know within a day
>    if it doesn't," without waiting for the post-pilot survey to notice a
>    string of failed captures.
>
> None of this needs to block the pilot start — it needs one real test run
> before it, and steps 2–3 can land alongside other fixes whenever there's
> time.

**H4 — Production JS is over budget for a mobile-first pilot.**
`npm run build` reports `App-*.js` at **661.82 kB / 240.87 kB gzip** — over
Vite's 500 kB warning threshold, and unlike the deliberately-deferred
examples chunk (`examples.generated-*.js`, 929 kB / 368 kB gzip, documented
in `README.md` as loaded *after* the app is interactive), this one **is** on
the critical path before first paint. The synthetic-run protocol explicitly
frames Woordkast as "a web page... participants open a URL in their phone
browser" (`docs/studies/README.md`) — worth a real load-time check on a
mid-range phone over mobile data before the pilot, not just the desktop dev
machine this was built on.

> ✅ **Fixed, with an honest trade-off.** `vite.config.ts` now splits the
> build via `manualChunks` into `vendor-react`, `vendor-supabase`,
> `dictionary-core` (the bundled 14k-word list — the single largest block of
> app-owned bytes), and a much smaller `App` chunk for the UI code itself:
>
> | Chunk | Before | After |
> | --- | --- | --- |
> | App (UI code) | 661.82 kB / 240.87 kB gzip | **60.59 kB / 17.85 kB gzip** |
> | vendor-react | *(inside App)* | 147.87 kB / 47.06 kB gzip |
> | vendor-supabase | *(inside App)* | 209.62 kB / 54.39 kB gzip |
> | dictionary-core | *(inside App)* | 385.53 kB / 167.63 kB gzip |
> | **Sum, first cold load** | **661.82 kB / 240.87 kB gzip** | **803.61 kB / 286.93 kB gzip** |
>
> **The honest part:** total bytes on a first, cold-cache visit went up
> (four separate gzip streams cost more overhead than one — roughly +19%
> gzip). What it buys back, and why it's still the right call for a 14-day
> pilot with daily practice sessions: `vendor-react`, `vendor-supabase`, and
> `dictionary-core` don't change between deploys (only `App` does), so
> **every visit after the first re-downloads only 17.85 kB gzip instead of
> 240.87 kB** — a 92% reduction on every repeat load for the two weeks the
> pilot actually runs. The four chunks also fetch in parallel over HTTP/2
> instead of serially, which typically nets out faster wall-clock time
> despite the larger byte sum, though that's a claim worth confirming on a
> real phone (§9) rather than trusting from a build log. The dictionary
> itself is still loaded eagerly, same as before and same as `README.md`
> documents as deliberate (search needs the whole list) — this split changes
> *how* those bytes travel, not *when* they're needed.
>
> One side benefit: the only chunk still over Vite's 500 kB warning
> threshold is `examples.generated` — which was already, by design, deferred
> until after the app is interactive. The warning no longer conflates a
> critical-path problem with an already-solved deferred one.

---

## 5. Medium/low-priority issues

**M1 — Medium, Accessibility.** Search/text inputs have no accessible name
beyond their placeholder: the `Appbar` search field
([`src/components/Appbar.tsx:57-66`](../src/components/Appbar.tsx#L57-L66),
used by Capture and Browse) and the "Add from text" textarea
([`src/screens/AddFromText.tsx:90-97`](../src/screens/AddFromText.tsx#L90-L97))
both rely on `placeholder` alone. Placeholder text is not a reliable
accessible-name substitute (WCAG 1.3.1/4.1.2 in practice; some AT and voice
control don't expose it as the field's name) and it disappears the moment
the user starts typing, which also hurts low-vision/cognitive users who
benefit from a persistent visible label. *Fix:* add `aria-label` (cheapest)
or a visually-hidden `<label>` to each.

> ✅ **Fixed.** `AppbarSearch` now takes a required `ariaLabel` field
> (`Appbar.tsx`), forcing every call site to set one deliberately rather than
> silently falling back to the placeholder — TypeScript catches a missing one
> at build time. Copy, kept distinct from the placeholder where a placeholder
> alone would undersell what happens next:
> - **Capture's search** (`Capture.tsx`) — placeholder stays "Search a Dutch
>   word" (already deliberately worded, per its own comment); `aria-label`:
>   *"Search a Dutch word to add to your deck"* — names the outcome, which
>   the placeholder's shorter form leaves out.
> - **Browse's search** (`Browse.tsx`) — placeholder stays "Search Dutch or
>   English…"; `aria-label`: *"Search your deck by Dutch or English word"* —
>   says *whose* words are being searched, which matters once "search" could
>   otherwise be read as searching the whole 14k-word dictionary.
> - **"Add from text"'s textarea** (`AddFromText.tsx`) — the placeholder is
>   deliberately Dutch (*"Plak of typ hier een stukje Nederlandse tekst…"*,
>   a prompt for Dutch input, matching the language being typed) so it can't
>   double as an English accessible name; added `aria-label`: *"Dutch text to
>   read and capture words from"*.

**M2 — Medium, Accessibility.** "Add from text"'s tappable words convey
*already added* purely through color + underline
(`.readtext__word--added`, [`app.css`](../src/styles/app.css)) with no
`aria-pressed`/`aria-label` change on the button itself
([`src/screens/AddFromText.tsx:117-135`](../src/screens/AddFromText.tsx#L117-L135)).
A keyboard or screen-reader user tabbing through pasted text has no way to
tell a word was already captured before re-activating it.

> ✅ **Fixed.** Each word button now gets `aria-label="{word}, already added
> to your deck"` once it's in `addedIndices`, and no `aria-label` at all
> otherwise (so its accessible name stays just the word, as before —
> no regression for the common case). Deliberately not `aria-pressed`: this
> isn't a toggle (tapping an added word re-opens its lookup card, it doesn't
> un-add it), and `aria-pressed` promises toggle behavior a screen-reader
> user would reasonably expect to work.

**M3 — Medium, Functional/Security.** Password minimum is 6 characters
(`Auth.tsx`, `NewPassword.tsx` — `minLength={6}`, matching Supabase's
default floor). Fine for a quick pilot signup, but these accounts will hold
real cloud-synced progress for two weeks; worth a conscious decision rather
than an inherited default, especially paired with Google sign-in sitting
right next to it as the stronger option.

**M4 — Medium, Functional (documented trade-off, surfaced for pilot
awareness).** `mergeState`'s own comment
([`src/lib/cloudState.ts:5-9`](../src/lib/cloudState.ts#L5-L9)) states
plainly: deleting a word on one device and then syncing from a second device
that still has it **can resurrect it**. This is an accepted, sensible
trade-off for a simple offline-first merge — but a pilot participant testing
on two devices (a phone and, say, a laptop browser) could see a "removed"
word come back and reasonably read it as a bug. Worth one line of facilitator
guidance, not a code fix.

**M5 — Medium, UX (already tracked, not new).**
`recommendations.md` item 3c ("stop offering distant fuzzy guesses") is
explicitly still open — the only item of the original eleven never picked
up. A miss can still surface an edit-distance-2 suggestion with no shared
prefix and no shared meaning. Carried here only so it appears in this
report's decision table (§11) rather than because this pass found anything
new about it.

> ✅ **Fixed**, per `recommendations.md` item 3c's own proposed direction
> ("require a shared prefix for distance-2 candidates"). `suggestWords`
> (`src/lib/wordSources.ts`) now runs in three passes instead of one: prefix
> matches (unchanged), then edit-distance-**1** matches with no prefix
> requirement (a single typo is close enough on its own — `"gestegn"` still
> suggests `"gestegen"`), then edit-distance-2 matches **only when the
> candidate shares the query's first letter**. `"gestegen"` no longer
> surfaces `"gisteren"` (different first letter, and no real relation) as a
> suggestion. `max` stays 3 (it already was — that half of the request was
> already true). Frequency-ranking, the other half of 3c's proposed fix,
> isn't implemented: the bundled dictionary carries no frequency data to
> rank by, and fabricating one wasn't in scope here — worth a separate,
> deliberate look if it's still wanted. All 62 existing tests still pass; no
> `suggestWords`-specific test existed to extend (worth adding one alongside
> `deinflect.test.ts`'s pattern, given this function's history of exactly
> this class of bug).

**L1 — Low, Accessibility/consistency.** Practice's grading-button icons
(the ✕ and ✓ SVGs) are raw inline `<svg>` markup, not the shared `Icon`
component that defaults every other icon in the app to
`aria-hidden="true" focusable="false"`
([`src/screens/Practice.tsx:205-213`](../src/screens/Practice.tsx#L205-L213)
vs. [`src/icons/index.tsx:11-30`](../src/icons/index.tsx#L11-L30)). The
buttons already carry visible/accessible text ("Still learning" / "I knew
it"), so this doesn't break the accessible name — it's a consistency gap,
not a blocker.

> ✅ **Fixed.** Both raw `<svg>` blocks in `Practice.tsx` are now `<Close
> size={16} />` and `<Check size={16} />` from `src/icons`, matching every
> other icon usage in the app — `aria-hidden="true" focusable="false"` for
> free. Bonus: the old markup hardcoded `stroke="#B5462F"` / `stroke="#fff"`
> to match the buttons' colors by hand; the shared icons paint with
> `fill="currentColor"`, so they now inherit `.btn--difficult`'s and
> `.btn--success`'s actual `color` token automatically — one less place a
> future palette change could drift out of sync. Visual shape changes
> slightly (Material Symbols' filled X/check glyphs vs. the old hand-drawn
> stroke marks) — worth a glance on a real screen, not just trusting it
> looks right from the diff.

**L2 — Low, UX.** The branded splash (`SPLASH_HOLD_MS` 1400ms +
`SPLASH_FADE_MS` 450ms, [`src/main.tsx:17-18`](../src/main.tsx#L17-L18)) is
unconditional on *every* load, with no way to skip it — not just first
launch. Over a 14-day pilot with several practice sessions a day, that's
~1.85s of fixed dead time on every single open. Worth deciding if it should
only play once per day/session rather than every time.

**L3 — Low, note only.** `caution-fg` on `caution-bg` (the leech/"Tricky"
warning color pair) computes to **4.50:1** — technically passes WCAG AA, but
with zero margin. Not a fix, just flagging it as the one color pair with no
room left if the palette shifts again.

---

## 6. Accessibility audit

### Automated
No automated tooling (axe, Lighthouse, etc.) is installed in this project
(`package.json` has no such dependency) and none was available in this
environment. Every finding below is manual/code-level. **Recommend running
axe-core or Lighthouse against a deployed build before the pilot** — it would
catch the contrast and label issues here in minutes and likely surface
others a manual read misses.

### Manual (code-level — see the caveat in the intro)
Covered: every screen (`src/screens/`), every shared component
(`src/components/`), `app.css`, and `tokens.json`'s color values run through
the actual WCAG contrast formula.

### WCAG-related findings
| Ref | WCAG criterion | Result |
| --- | --- | --- |
| C1 | 4.1.2 Name, Role, Value / 1.3.1 Info and Relationships | Was Fail → **Fixed** (Option A + a face-level `aria-hidden` toggle — §3); real screen-reader check still pending |
| C2 | 1.4.4 Resize Text | Was Fail → **Fixed** — `maximum-scale=1.0` removed (§3); real-device 200%-zoom check still pending |
| H1 | 1.4.3 Contrast (Minimum) | Was Fail (2.05–2.18:1) → **Fixed**, now 5.10–5.41:1 (stopgap, pending Figma review — §4) |
| H2 | 1.4.3 Contrast (Minimum) | Was Fail (4.33–4.59:1) → **Fixed**, now 5.73–6.07:1 |
| M1 | 4.1.2 Name, Role, Value | Was Fail → **Fixed** — `ariaLabel` now required on every search field |
| M2 | 4.1.2 Name, Role, Value | Was Fail → **Fixed** — added-state now in the accessible name |
| L3 | 1.4.3 Contrast (Minimum) | Pass, no margin |
| — | 1.4.1 Use of Color | Pass — mastery bars carry a text label (`MasteryBar.tsx` `aria-label`) alongside color/fill, not color alone |
| — | 2.4.7 Focus Visible | Pass — `.btn`, `.icon-btn`, `.tab`, `.flashcard` all define explicit `:focus-visible` rings (`app.css`) |
| — | 2.3.3 / Animation | Pass — every transition/animation in `app.css` has a `prefers-reduced-motion: reduce` override, plus a JS-timed (not CSS-timed) toast so it also disappears under reduced motion (`Practice.tsx`) |

### Keyboard
Traced, not driven live. Every icon-only control (`IconButton`, tab bar,
appbar back/close/clear) has a proper `<button>` element and an `aria-label`
at every call site checked. Focus-visible styling is defined for the main
interactive classes (above). No `tabIndex` misuse or focus traps found in
source. **Gap:** the flashcard (C1) and the "add from text" word buttons
(M2) are keyboard-*reachable* but don't communicate enough *state* once
you're there — a keyboard user can tab to the flashcard and activate it, but
gets no better information than a screen-reader user would (see C1).

### Screen reader
Not run against a real reader (no tool available) — inferred from markup
only. C1 is the standout: high-confidence from DOM structure, needs a real
VoiceOver/TalkBack pass to confirm exact wording. Elsewhere, icon-only
buttons are consistently labelled, status messages use `role="status"`
(`Notice.tsx`, `WordLookupResult.tsx`'s "Searching…" line), and the practice
progress bar uses full `role="progressbar"` + `aria-valuenow/min/max/valuetext`
(`Practice.tsx:130-137`) — genuinely good practice, not just adequate.

### Forms
Auth's email/password fields, the deck-row edit form, and the OTP code field
all correctly wrap `<input>` in a `<label>` with visible text
(`.auth-field`) — real labels, not placeholder-only. The two exceptions are
M1 (search fields, the "add from text" textarea). Required fields use native
`required`/`minLength`; error messages render as a `Notice` above the form
rather than inline per-field, which is legible but doesn't programmatically
associate the error with the specific input that caused it (`aria-describedby`
is not used anywhere in `Auth.tsx`).

### Visual
Not observed rendering. From tokens/CSS only: type sizes are all defined in
absolute `px` via CSS custom properties (no user-configurable base-font
scaling path evident, e.g. no `rem`-based sizing off the root), so a user's
browser-level "larger text" preference has less effect than it would with
`rem`/`em` sizing — combined with C2 (zoom disabled), this narrows a
low-vision user's options to whatever the OS-level accessibility zoom offers
outside the browser entirely.

### Responsive
Not observed on a real device. From CSS: the app renders as a fixed
420px-wide "phone" card, centered with padding on viewports ≥480px
(`app.css` `.phone`, `@media (min-width: 480px)`), and full-bleed below
that. No breakpoints beyond that single one — appropriate for a
"mobile-first, always a phone-shaped card" design intent (confirmed in
`README.md`), but means desktop/tablet testers in the pilot cohort will see
a letterboxed phone frame on a large screen, not a redesigned layout. Likely
intentional given the product's framing; worth confirming that's still the
call for this cohort.

### Cognitive
Copy is consistently plain and concrete (confirmed across screens read) —
short sentences, no jargon, explicit next-steps ("Undo" / "View your deck"
after every capture). Error states are specific rather than generic ("The
online dictionary didn't respond. Check your connection and try again.",
not "Something went wrong"). The one friction point is L2 (mandatory splash
on every load) — small, but it's dead time with no purpose after the first
visit.

---

## 7. Systemic issues

- **The `text-faint`/`--ink-500` token is used everywhere secondary text
  appears, and it's under WCAG AA contrast on both surfaces it's used
  against** (H2). Because it's one token, not scattered inline colors,
  fixing it once (darkening it a step) fixes every instance at once — this
  is the highest-leverage single change available in this audit.
- **Icon-only affordances are labelled everywhere except where state, not
  identity, needs communicating** (C1, M2) — the pattern of "give every icon
  button an `aria-label`" is followed consistently, but the *content* inside
  a bigger interactive container (the flashcard) and *toggled state* (added/
  not-added word) aren't covered by that same discipline. Worth extending
  the same rigor already applied to `IconButton` call sites to these two
  cases.
- **Every synthetic run to date shares one blind spot: the live Wiktionary
  fallback** (H3). This isn't a code issue — it's a five-times-repeated gap
  in how the app has been validated, worth closing with one real, online
  test run before the pilot rather than a sixth synthetic pass that will hit
  the same wall.

---

## 8. Interesting UX problems to keep for user testing

These aren't defects — they're places where the *right* answer depends on
how real learners actually behave, which is exactly what the 14-day pilot
and its survey (`docs/pilot-survey.md`) exist to find out. Worth watching
for in the pilot data rather than fixing pre-emptively:

- **Does the in-session recycle (`MAX_RECYCLES = 2`,
  [`Practice.tsx:26`](../src/screens/Practice.tsx#L26)) actually help
  retention, or does it just make a session feel longer for a word that was
  going to come back tomorrow anyway?** The pilot's mastered-vs-control
  comparison (`pilot-survey.md` §5) is set up to answer exactly this.
- **The ladder promotes on a binary "know"/"don't know" self-report with no
  confidence check.** `pilot-survey.md`'s own diagnostic query (words the app
  called "mastered" that a survey respondent got wrong) is designed to catch
  this — worth watching closely for the first cohort, since a wrong "I knew
  it" is the failure mode item 1 in `recommendations.md` was written about.
- **The deck's mastery-bar tiers ("New" / "Learning" / "Strong" / "Mature")
  are a coarser signal than the underlying 0–6 ladder level.** Whether that
  coarseness reads as reassuring or vague to a real learner is worth a
  direct question in the post-pilot survey.
- **M5 (distant fuzzy guesses, item 3c)** — now tightened (shared-prefix
  requirement on distance-2 matches, see §5). Worth watching whether the
  *remaining* suggestions — the ones that survive the new filter — are
  actually helpful to a real learner or just less wrong than before; that's
  a pilot question now, not an open bug.

---

## 9. Untested areas

Everything here needs a human, a real device, or access this session
doesn't have — not further code reading. Ranked by how much the pilot
depends on it:

1. **The live Wiktionary fallback (H3).** Highest priority: run one real
   capture of a word outside the 14k-word bundled dictionary, from a network
   that isn't blocked, and watch all three branches — success, "not found,"
   and "the online dictionary didn't respond" — actually fire.
2. **Whether the production Supabase project is configured the way
   `docs/auth-setup.md` assumes** — the confirmation-email template swapped
   to `{{ .Token }}` (otherwise sign-up still shows a link, which the app
   handles gracefully but isn't the intended pilot experience), Site
   URL/Redirect URLs pointing at the real pilot domain, and the Google OAuth
   client actually created and enabled. None of this lives in this
   repository, so it cannot be confirmed from a checkout.
3. **Whether the `Deploy to Hostinger` GitHub Action's repo secrets are
   set** (`FTP_*`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) —
   if the Supabase secrets are missing, the deployed build is silently
   offline-only (this is documented as a graceful fallback, not a crash, but
   it would mean the pilot's cloud-sync/accounts never actually existed in
   production).
4. **The Google OAuth handshake itself** — explicitly out of scope for every
   synthetic run; needs a real human with a real Google account.
5. **Real screen-reader behavior** — VoiceOver on iOS is what most pilot
   participants would carry, per the mobile-first framing. C1, M1, and M2
   are all fixed in the tree now, but, like everything else here, never
   confirmed against a real reader — C1 especially: whether a real
   VoiceOver/TalkBack pass actually restricts the flashcard's announced name
   to the currently-showing face, the way the new `aria-hidden` toggle
   asserts it should, is exactly the kind of claim this pass can predict
   from markup but can't verify without one.
6. **Real mobile performance** — H4's chunk-splitting fix is a build-log
   claim about parallel fetching and cache reuse; confirm the actual
   wall-clock difference on a mid-range phone over mobile data, not
   localhost.
7. **Password-reset email deliverability and the "check your email" round
   trip** — never exercised against a real inbox by any synthetic run,
   including this one.
8. **Two-device sync in practice** — M4's documented resurrection trade-off,
   confirmed by reading, not watched happening.

---

## 10. Final smoke test

First run against build `b9b5303`; re-run after the resolution pass below
(working tree, not yet committed):

| Check | Command | Before | After |
| --- | --- | --- | --- |
| Type-check + production build | `npm run build` | ✅ Pass, no type errors | ✅ Still pass, no type errors |
| Bundle size (critical-path chunk) | (same) | ⚠️ `App-*.js` 661.82 kB / 240.87 kB gzip | ✅ `App-*.js` **60.59 kB / 17.85 kB gzip** + 3 cacheable chunks (H4) — `examples.generated` remains the only chunk over Vite's 500 kB warning, unchanged, already deferred |
| Unit tests | `npm test` (vitest) | ✅ 62/62 passing | ✅ Still 62/62 passing across the same 5 suites — no test needed updating for any fix above |
| Production server boots and serves the real bundle | `npm run preview` + `curl` | ✅ `index.html`, JS, CSS all 200 | Not re-run after the resolution pass — the build itself passing is the stronger signal here |
| Live render in a browser | — | ❌ Not performed | ❌ **Still not performed** — no browser-automation tool available in this session, before or after. Nothing about actual on-screen appearance was ever observed; only build/type/test-level correctness is confirmed for the fixes above. |

---

## 11. Issue decision table

| ID | Issue | Type | Severity | User-testing impact | Recommended action | Status |
|----|-------|------|----------|---------------------|--------------------|----------------|
| C1 | Flashcard's `aria-label` hides all card content from screen readers | Accessibility / Functional | Critical | Screen-reader users cannot do the core practice task | Restructure so content is exposed separately from the flip trigger | ✅ **Fixed** — Option A applied (label removed) plus a per-face `aria-hidden` toggle beyond what Option A alone specified; needs real screen-reader confirmation |
| C2 | Viewport `maximum-scale=1.0` disables pinch-zoom app-wide | Accessibility | Critical | Blocks low-vision users from zooming anywhere in the app | Drop `maximum-scale=1.0` from `index.html` | ✅ **Fixed** — one-line removal applied; needs real-device 200%-zoom confirmation |
| H1 | Inactive tab-bar labels at 2.05–2.18:1 contrast | Accessibility | High | Persistent, always-visible nav fails AA by 2×+ | Darken `--inactive` token | ✅ **Fixed (stopgap)** — now 5.10–5.41:1; not verified against your Figma redesign (MCP unavailable this session — see note at top) |
| H2 | `text-faint` token under AA on word glosses/labels app-wide | Accessibility | High | Affects legibility of word meanings, not just captions | Darken `--text-faint`/`--ink-500` token once, fixes every instance | ✅ **Fixed** — `#6b7689` → `#596373`, now 5.73–6.07:1 |
| H3 | Online-dictionary fallback never observed live | Functional / Untested | High | Most environment-fragile part of the core "add a word" flow, unverified in 5 runs + this pass | Run one real online capture before the pilot | **Advice given (§4)** — needs a human on an unblocked network, not code |
| H4 | Main JS chunk 661.82 kB / 240.87 kB gzip, on critical path | Performance | High | Slower first load on mobile data, contradicts mobile-first framing | Check real load time on a phone; consider code-splitting | ✅ **Fixed, with a trade-off** — App chunk now 17.85 kB gzip, cached across repeat visits; total cold-load bytes rose ~19% (details in §4) |
| M1 | Search fields / textarea have no accessible name beyond placeholder | Accessibility | Medium | Fails for AT/voice control; label vanishes once typing starts | Add `aria-label` or visible label | ✅ **Fixed** — `ariaLabel` now required on every `AppbarSearch`, plus the textarea |
| M2 | "Add from text" added-state is color-only, not exposed to AT | Accessibility | Medium | Keyboard/AT users can't tell a word was already captured | Add `aria-pressed`/label change | ✅ **Fixed** — via `aria-label`, not `aria-pressed` (see §5 for why) |
| M3 | Password minimum is 6 characters | Functional / Security | Medium | Weak for accounts holding two weeks of real progress | Raise minimum or accept as a pilot-scale trade-off | Not actioned — decision, not a code fix |
| M4 | Merge-on-login can resurrect a word deleted on another device | Functional (documented trade-off) | Medium | Could read as a bug to a two-device tester | Brief facilitators; no code change needed | Not actioned — facilitator note, not a code fix |
| M5 | Distant fuzzy-match suggestions still possible (`recommendations.md` 3c) | UX | Medium | Already tracked, was still open | Max 3 results, require a shared prefix at distance 2 | ✅ **Fixed** — matches `recommendations.md` 3c's own proposed direction |
| L1 | Practice's grade-button SVGs skip the shared `Icon` component's `aria-hidden` default | Accessibility | Low | Minor AT noise; doesn't break accessible name | Route through shared `Icon` component | ✅ **Fixed** — now `<Close>`/`<Check>` from `src/icons`, inheriting button color via `currentColor` |
| L2 | Branded splash plays on every load, not just first | UX | Low | ~1.85s dead time per open, repeated many times over 14 days | Gate to once per day/session | Not actioned — not requested this pass |
| L3 | `caution-fg`/`caution-bg` passes AA with zero margin | Accessibility | Low | No action needed now; flag for future palette changes | Note only | Not actioned — note only, no fix needed |

---

## Sources

- [`docs/recommendations.md`](./recommendations.md) — the 11 shipped findings this report builds on top of, not around
- [`docs/studies/`](./studies/) — the 5 synthetic walkthroughs (`run-01`–`run-05`) that supply the live-behavior evidence this pass doesn't have
- [`docs/pilot-survey.md`](./pilot-survey.md) — what the pilot itself is measuring, referenced in §8
- [`docs/auth-setup.md`](./auth-setup.md) — the manual Supabase configuration this report can't verify (§9)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/) — criteria cited in §6/§11
