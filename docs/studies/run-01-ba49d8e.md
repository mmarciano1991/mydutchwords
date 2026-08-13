# Run 01 — synthetic first-run walkthrough

**Build `ba49d8e` · 13 August 2026 · frozen**

A single synthetic participant (expat in NL, learning Dutch for daily life, no
prior exposure to Woordkast) attempting the three core tasks. The purpose is
narrow: **check that the task script and the happy path are logically
coherent** before real participants see it in Study 2.

Completion rate, timing and satisfaction are explicitly out of scope — see the
last section. What this run found on this build stands as written; fixes made
afterwards are listed in the appendix, not edited into the findings. See
[README](./README.md) for the convention.

---

## App description (Section 2, filled in from the code)

The template's app description was blank, so this is reconstructed from the
source. Use this version in future runs.

**What Woordkast is.** A mobile-first *web* app (React + Vite, served from a
URL — not an installable store app) for building a personal deck of Dutch
words and practising them as flashcards. It ships with a bundled offline
dictionary of 14,193 Dutch→English words; ~14,075 of those also carry `de/het`
gender and an example sentence. Words not in the bundle are looked up live
against English Wiktionary. Deck and progress live in `localStorage` and sync
to a Supabase account.

**Access.** Hard gate — a signed-out visitor cannot reach any part of the app.
There is no guest mode.

| Screen | What's on it |
| --- | --- |
| Splash | 1.4 s hold, then fades. Brand only. |
| Welcome | Medallion, "Woordkast", tagline. Buttons: **Sign in** (primary → *creates* an account) and **Log-in** (secondary → signs in). |
| Auth | Title "Create account" or "Sign in". Email + password (min 6), **Continue with Google**, and a mode-switch link. Sign-up may end in "check your inbox for a confirmation link". Back chevron → Welcome. |
| Home (empty deck) | Brand, tagline, **Add your first word**. Tab bar visible; the + FAB is hidden. |
| Home (with deck) | Hero card. Due: "You have N words ready to review in your deck." + **Start practice**. Caught up: "You're all set!" + **Prepare in advance**. Streak line when > 1 day. |
| Add a word (capture) | Appbar "Add a word" + back chevron + search field ("Search your word"). States: suggestions ("Did you mean" chips + "No — look up "x" online"), found (word card + **Add to deck**), already in deck (row + notice), not found, network error + **Try again**. Saving navigates to Your deck. |
| Your deck (Deck tab) | Appbar "Your deck" + search. Rows: expand chevron, de/het chip, Dutch, "Tricky" tag, English gloss, mastery bar + tier label (New / Learning / Strong / Mature), remove button. Expanding shows "In context" with the example sentence. |
| Practice | Close (X), progress bar, "n/N", eyebrow, flashcard (tap to flip), **Still learning** / **I knew it**. Missed cards are re-queued to the end, up to 2 retries each. Toast: "Next review in N days" / "One more try coming up" / "Coming back tomorrow". |
| Practice summary | "Batch of N done", "Goed bezig!", stat cards Knew it / To review, list of words to review, then **Continue to next N** and/or **Review missed words**, or **Back to dashboard** when neither applies. No tab bar, no close button. |
| Settings | Account card (email, **Sign out**), dictionary size, deck size. |

**Navigation.** Bottom pill: Home / Deck / Settings, plus a + FAB that opens
Add a word. Tab bar and FAB are hidden on Practice, Practice summary and Add a
word.

**Not built / out of scope** (per `README.md`): photo or OCR capture, audio
pronunciation, tags, sharing, and browsing the full bundled dictionary (words
now only enter the deck via capture).

---

## Task-by-task walkthrough

### Task 1 — capture from reading

> "Read this short Dutch article. When you hit a word you don't know, capture
> it into Woordkast."

Article stand-in (nos.nl unreachable from the test environment): a housing
piece containing *"De huurders van woningcorporaties zagen hun huur vorig jaar
gemiddeld met 4,7 procent gestegen. Het kabinet heeft afspraken gemaakt over
de huurverhoging."*

| # | Step | Expected | Actual | |
| --- | --- | --- | --- | --- |
| 1 | Open the link | Some kind of app | Splash for 1.4 s, then a Welcome screen. Fine. | ✅ |
| 2 | Choose between **Sign in** and **Log-in** | One of these means "I'm new" | They're synonyms. Neither says "create an account" or "sign up". I have no account, so I want the *new user* path — I genuinely cannot tell which button that is. I'd guess the big primary one. | ⚠️ |
| 3 | Tap **Sign in** | A sign-in form | Screen titled **"Create account"**. It's the right screen for me, but I tapped a button that said the opposite. Now I'm unsure whether I just created something. | ⚠️ |
| 4 | Enter email + password, submit | I'm in | Green notice: *"Almost there — check my@email for a confirmation link, then sign in."* I have to leave the app, open my mail, click a link, come back, and sign in **again**. I was told to read an article, not do an account setup. This is where a busy person puts the phone down. | ❌ |
| 5 | Return, sign in | Straight to the app | Works. Empty home: brand, tagline, **Add your first word**. | ✅ |
| 6 | Get the article into the app | Paste the text, share it in, or open it in the app | Nothing. No reader, no paste-a-text, no share target, no clipboard prompt. I have to switch tabs, read, hold the word in my head, and switch back. For a word I don't know, that means memorising an unfamiliar string. | ❌ |
| 7 | Tap **Add your first word** | A place to add a word | "Add a word" with a focused search box: *"Search your word"*. Search *what*? My deck? The internet? "Your word" reads like it's already mine. | ⚠️ |
| 8 | Type **huurders** (as printed in the article) | The translation | After a pause: **Did you mean** [huurder], and a link "No — look up "huurders" online". I don't know that *huurders* is the plural of *huurder* — that's the kind of thing I'm using this app to learn. The chip is offered with no explanation of why. | ⚠️ |
| 9 | Tap [huurder] | Its meaning | The word card: **de huurder**, "tenant / renter", example sentence. **Add to deck**. Good. | ✅ |
| 10 | Tap **Add to deck** | Confirmation, then back to reading | Dropped onto "Your deck" with one row. No toast, no "add another". To capture a second word I have to spot the unlabelled + button. | ⚠️ |
| 11 | Try the next unknown word, **gestegen** | Same recovery as step 8 | **Did you mean** [gisteren] [genoegen] [vestigen] — "yesterday", "pleasure", "to establish". All wrong. The right answer (*stijgen*, "to rise") is not offered, and because suggestions exist the app never goes online on its own. My only escape is a link I have to read carefully. This is the step where I'd conclude the app "doesn't have" the word. | ❌ |

**Task 1 verdict:** the reading half of the task has no support in the app at
all, and the two words I'd realistically pick from a real article both arrive
inflected, which is exactly the case the lookup handles worst.

### Task 2 — capture from a photo

> "Now capture a few more words from a photo of a sign or a letter."

| # | Step | Expected | Actual | |
| --- | --- | --- | --- | --- |
| 1 | Look for a camera | A camera icon or "scan" somewhere | Home, Deck, Settings, and a + that opens a text search. No camera, no image picker, no permission prompt, nothing referencing photos anywhere in the app. | ❌ |
| 2 | Re-read the task | Maybe it's hidden behind the + | The + is the same "Add a word" search box. I'd now assume I've misunderstood the task and ask the facilitator. **The task cannot be completed as written.** | ❌ |
| 3 | Fall back to typing what's on the letter — **aanslag** (from a tax letter) | "tax assessment" | "de aanslag — attack / assault". Confidently wrong for this context, offered as the only meaning, with no second sense and no way to correct it. I would save a wrong meaning and practise it for two weeks without knowing. | ❌ |
| 4 | **termijn** (from "binnen zes weken") | "term / deadline" | **Did you mean** [terwijl] ("while"). Wrong, and again the online lookup is suppressed because a suggestion exists. | ⚠️ |
| 5 | **weken** (same sentence) | "weeks" | Silently resolves to "weken — to soak". No warning, no alternative sense. I add it and I'm now learning the wrong word. | ❌ |
| 6 | **huurtoeslag** | Not in the small dictionary | No suggestions, so it goes online by itself. Comes back from Wiktionary with a gloss but **no de/het and no example sentence** — visibly thinner than the other cards, unexplained. | ⚠️ |
| 7 | Capture "a few more" in a row | Add several without leaving | Every save bounces me to "Your deck". Four taps per word: FAB → type → Add to deck → find FAB again. | ⚠️ |

**Task 2 verdict:** ❌ as scripted. The fallback path exposes the sharpest
content problem in the app — for the exact vocabulary a letter or sign
produces, wrong senses are returned silently and cannot be corrected.

### Task 3 — practice

Assuming a deck of ~4 words captured above.

| # | Step | Expected | Actual | |
| --- | --- | --- | --- | --- |
| 1 | Open Home | Somewhere to start | Hero: "You have 4 words ready to review in your deck." **Start practice**. Clear. | ✅ |
| 2 | Tap **Start practice** | Flashcards | Card front: **de huurder**, the Dutch example sentence, "Tap to flip". Eyebrow: "Do you know this word?" Buttons: **Still learning** / **I knew it**. | ✅ |
| 3 | Decide what to do first | Flip, then rate | I *can* rate without flipping — nothing stops me and nothing tells me the intended order. The eyebrow asks a question and the buttons answer it, so tapping straight through looks legitimate. | ⚠️ |
| 4 | Tap the card | The translation | Flips to English + English example. Good. | ✅ |
| 5 | Tap **I knew it** | Next card | Toast: "Next review in 1 day". Nice — the schedule is legible. | ✅ |
| 6 | Tap **Still learning** on a word I missed | Next card | "One more try coming up", and the counter goes **2/4 → 3/5**. The session got *longer* because I got one wrong. Not explained anywhere; it reads like a penalty or a bug. | ⚠️ |
| 7 | Finish the batch | A summary | "Batch of 4 done", "Goed bezig!", "A quick check-in — not a grade." Knew it 3 / To review 1, and the missed word listed under "Coming back sooner". Warm and clear. | ✅ |
| 8 | Leave and get on with my day | A way back home | **The only button is "Review missed words".** No "Back to dashboard", no close (X), and the tab bar is hidden on this screen. My only move is another round. | ❌ |
| 9 | Tap **Review missed words** | Drill it once, then out | It's the word I don't know, so I miss it again. That produces another summary — with, again, only **Review missed words**. I'm in a loop, and the only exit is answering "I knew it" on the first attempt for every word I just told the app I don't know. Reloading the page is the real escape. | ❌ |
| 10 | (Separately) Quit a session halfway with the X | Progress kept | Every answer in that session is discarded silently — no warning, no confirmation, and the dashboard still shows the words as due. | ❌ |

**Task 3 verdict:** the core loop is genuinely good up to the summary screen,
then dead-ends. Step 8/9 will strand real participants.

---

## Dead-ends and missing steps

| Task | Step | What's missing or broken |
| --- | --- | --- |
| 3 | Summary screen | **Dead-end loop.** When a session has missed words and no next batch, the only action is "Review missed words". No dashboard button, no close, no tab bar. Honest answers keep regenerating the same screen. `SessionReport.tsx:112-127`, `App.tsx:259`. |
| 3 | Practice → X | **Silent data loss.** Closing a scheduled session discards every grade already given. No confirm, no partial save. `Practice.tsx:99`, `App.tsx:348`. |
| 2 | All | **No photo capture exists.** No camera, gallery picker, OCR, or permission step anywhere. The task as written has no path. `README.md:87-88`. |
| 1 | Step 6 | **No route from reading into the app.** No paste-text, share target, clipboard read, or in-app reader. The participant must retype a word they can't yet read. |
| 1 | Step 4 | **Email confirmation isn't in the script.** Sign-up can end in "check your inbox", which forces an app-switch, an inbox, and a second sign-in mid-task. |
| 1 | Step 2 | **No password recovery.** The Auth screen has no "forgot password" link. A returning Study 2 participant who forgets is locked out with no self-serve path. `Auth.tsx`. |
| 1, 2 | Lookup | **Inflected forms aren't handled.** Article and letter Dutch is inflected; lookup is exact-match on the lemma. `huurders`, `maatregelen`, `gestegen`, `toegenomen`, `afspraken`, `duurder`, `verboden` all miss. |
| 1, 2 | Suggestions | **A near-match suppresses the online lookup.** `searchable = missed && suggestions.length === 0` (`Capture.tsx:69`), so a wrong edit-distance guess (`termijn`→`terwijl`, `gestegen`→`gisteren`) blocks the fallback behind a text link. |
| 2 | Step 3, 5 | **No sense disambiguation and no way to correct a translation.** `aanslag`→"attack / assault", `weken`→"to soak" are returned as the single meaning. Saved words can only be removed, never edited or annotated. |
| 1, 2 | After save | **No "add another".** Saving navigates to the deck, so capturing several words in a row costs four taps each. `App.tsx:171`. |
| — | Setup | **The script says "mobile app".** It's a web app at a URL, not installable. Participants need the URL and a browser step the script doesn't mention. |
| — | Minor | Tier labels disagree with the analysis doc: the app calls level 1 "New" (`MasteryBar.tsx:11-16`), `docs/pilot-survey.md` calls levels 1–3 "learning". Cosmetic, but it will bite when you compare screenshots to query output. |

## Ambiguous wording

| Where | Exact copy | The ambiguity |
| --- | --- | --- |
| Welcome | **"Sign in"** (primary) / **"Log-in"** (secondary) | Universally synonyms. Here the first *creates an account* and the second signs an existing one in. A first-time user has a coin-flip, and either way the next screen's title contradicts the button they pressed. |
| Add a word | **"Search your word"** | Reads as "search among your words" — i.e. my deck. It actually searches a dictionary I've never seen. Also unclear whether it searches online. |
| Add a word | **"No — look up "huurders" online"** | "No —" answers the *"Did you mean"* above it, but the two are far enough apart to read as a standalone refusal. And it implies the previous search was *not* online, which the user has no way to know. |
| Home (caught up) | **"Prepare in advance"** | Prepare for what? Doesn't convey "practise words that aren't due yet, without affecting your schedule" — the thing it does. |
| Practice | **"Still learning"** vs **"I knew it"** | Mixed tense and mixed frame: a status vs. a past-tense claim. "Still learning" also sounds like the gentle option regardless of whether you actually knew it. |
| Practice | Eyebrow **"Do you know this word?"** with both buttons visible pre-flip | Implies you should answer now. Nothing says "flip first, then be honest". |
| Practice | **"Warm-up — does not change your schedule"** | Only appears once the user is already inside a warm-up session; the button that started it ("Prepare in advance") never said so. |
| Summary | **"Batch of 4 done"** / **"Continue to next 6"** | "Batch" is app-internal vocabulary introduced at the end of the session, never before it. Users don't know a session has batches or how many exist. |
| Summary | **"Coming back sooner"** | Sooner than what? No baseline was ever shown. |
| Summary | **"Goed bezig!"** | Untranslated Dutch praise in an app whose whole premise is that the user can't read Dutch yet. Charming, but it's the one place with no translation. |
| Deck row | **"Tricky"** | Never explained. It's automatic (4+ lapses), but reads like something the user set. |
| Deck row | Mastery tiers **New / Learning / Strong / Mature** | Four unexplained levels on an unlabelled bar; "Mature" is an odd word for a word. |

## Assumed prior knowledge

- The unlabelled **+ FAB** is the only way to add a word after the first one.
- The **chevron on a deck row** reveals "In context" — icon-only, no affordance copy.
- The **de/het chip** is grammatical gender, not a category or tag.
- That an entry with **no gender chip and no example sentence** came from the online fallback rather than being broken.
- That **"Did you mean" chips are spelling guesses**, not grammatical relatives — so `huurders → huurder` is correct but `gestegen → gisteren` is not, and the user is expected to tell the difference in a language they're learning.

---

## Revised task script (for Study 2)

Setup to do *before* the participant starts, so the tasks measure the app and
not the account system:

> **Facilitator pre-step.** Have the participant open `<URL>` in their phone
> browser and create an account, including any email confirmation, before the
> first task begins. Confirm they land on a screen saying "Add your first
> word". If confirmation email is enabled, warn them it's coming.

**Task 1 — capture while reading**

> Here is a short Dutch news article (on paper / in a second browser tab):
> `<real NOS article>`. Read it as you normally would. When you reach a word
> you don't know and would want to remember, add that word to Woordkast, and
> keep going. Add two or three words this way. Think aloud as you go —
> especially if the app shows you something you didn't expect.

*Changed:* names the article's location so the app-switch is expected rather
than a surprise; says "add" instead of the app's internal "capture"; sets an
explicit number so the repeat-capture friction actually gets exercised;
removes the assumption that the reading happens inside the app.

**Task 2 — capture from something in your life** (photo capture is not built)

> Here is a letter from the gemeente / a photo of a street sign: `<artefact>`.
> Pick out three words you don't recognise and add them to Woordkast. When you
> see the meaning the app gives you, tell me whether it matches what you think
> the word means here.

*Changed:* drops the photo mechanic entirely — the app has no camera, so
scripting one only produces a dead task. The added closing question is
deliberate: it's how the wrong-sense problem (`aanslag`, `weken`) surfaces in
a session instead of silently entering the participant's deck. **Re-script
this task as a photo task only once capture-from-image ships.**

**Task 3 — practice what you saved**

> Practise the words you've added. Work through them the way you would on a
> normal day, and stop when you feel you're done for now. Tell me what you'd
> do next.

*Changed:* "start a practice / flashcard session and work through the words"
pre-teaches both the entry point and the intended completion. This version
leaves the exit unscripted, which is what surfaces the summary-screen loop.
Have a recovery instruction ready ("reload the page") so participants aren't
genuinely stuck — and log every time you need to use it.

---

## Explicitly out of scope for this report

No completion rate, no task timing, and no usability or satisfaction
judgement. This run only validates that the script and happy path are
logically coherent. Real friction is measured in Study 2.

---

## Appendix — fixed since this run

Status only. The findings above describe build `ba49d8e` and are not edited.

| Finding | Status | Where |
| --- | --- | --- |
| "Sign in" / "Log-in" are synonyms on Welcome | Fixed — "Create an account" / "Log in", carried through Auth, its submit button, the blurb, the confirmation notice, the mode-switch link, and Settings' "Log out" | `7ca3175` |
| Auth title contradicts the button that opened it | Fixed by the same change — each path keeps its own word throughout | `7ca3175` |
| "Search your word" reads as searching your own deck | Fixed — "Search a Dutch word", plus a start-state line: "Look up a Dutch word in the dictionary, then add it to your deck" | `7ca3175` |
| Deck empty state doesn't teach the + button | Fixed — "Your deck is empty. Tap + to look up a word and add it here." | `7ca3175` |
| Practice counter grows on a miss (2/4 → 3/5) | Fixed — progress counts words finished out of the session's distinct words; a miss holds the bar still | `c5b3d62` |

| The summary screen loops when a session leaves missed words | Fixed — "Back to dashboard" is always offered | `43a1fdd` |
| Closing a session discards its grades silently | Fixed — answers are written as they're given | `43a1fdd` |
| Email confirmation isn't in the script | Fixed both ways — it's a step in the app now ("Check your email", with resend), and the pre-step covers it | `43a1fdd` |
| No password recovery | Fixed — "Forgot your password?" sends a link, which lands on "Set a new password" | `43a1fdd` |
| The script called the app a "mobile app" | Fixed in the run protocol — scripts must hand over a URL and say there's nothing to install | `43a1fdd` |

Everything else stands. Still open as of run 03: no route from reading into
the app, no photo capture, silent wrong senses, inflected-form lookup,
pre-flip grading, and no "add another".
