# Run 03 — synthetic first-run walkthrough

**Build `43a1fdd` · 13 August 2026 · frozen**

Same persona and tasks, run after the four dead-end fixes that followed
[run 02](./run-02-c5b3d62.md). The account screens and the practice summary
were driven in a real browser, with Supabase's endpoints stubbed so the
waiting-on-email steps and the recovery link could actually be walked rather
than reasoned about.

The article stand-in is unchanged from run 01 (`nos.nl` is still unreachable
from this environment), and the letter for task 2 is still described rather
than photographed.

---

## Since the last run

| What earlier runs found | This build |
| --- | --- |
| Summary screen loops: missed words and no next batch left only "Review missed words", on a screen with no tab bar and no close | **Back to dashboard** is now always present — a link beside the other actions, the primary button when there are none. Walked it: after missing every word, the footer read `["Review missed words", "Back to dashboard"]`, and the second one left. ✅ |
| Closing a session discarded every grade already given | Answers persist as they're given. Answered one card, closed with the ×, and read storage: one row in the practice log, that word at level 1, the untouched word still at level 0. The dashboard then correctly offered the one remaining word. ✅ |
| Sign-up could end at "check your inbox" with nothing to do | It's a step now: titled **Check your email**, it says what to open, and offers **Send it again** (which reports "Sent again") and **Back to log in**. ✅ |
| No password recovery — a participant who forgets is locked out | **Forgot your password?** sits under the log-in button. It sends a link, confirms on the same "Check your email" step, and following the link lands on **Set a new password** rather than dropping the user into the app with the password they came to change. Saving it returns to the app. ✅ |
| The script called this a "mobile app" | Fixed in the protocol, not the code: the [README](./README.md) now requires every script version to hand over a URL and say there's nothing to install. ✅ |

The recovery screen suppresses the tab bar — worth stating because the
recovery session *is* signed in, so the app would otherwise have drawn
navigation beneath a screen that isn't part of the app. Confirmed absent while
recovering and back afterwards.

---

## Task 1 — capture from reading

Steps 1–5 now run clean, and the account work that used to interrupt this task
is either handled by the pre-step or has somewhere to go when it happens.

| # | Step | What happened | |
| --- | --- | --- | --- |
| 2–3 | Create an account | Unchanged from run 02 and correct throughout. | ✅ |
| 4 | Sign-up ends at a confirmation | No longer a stop. The screen tells me what to open, offers to resend if nothing arrives, and gets me back to log in. It still takes me out of the app to my inbox — that's the mechanism, not the copy — so the pre-step stays. | ⚠️ |
| 6 | Get the article into the app | **Unchanged.** No reader, no paste-a-text, no share target. I read in another tab and retype from memory. | ❌ |
| 7 | Open Add a word | Clear since run 02. | ✅ |
| 8 | Type **huurders** | Unchanged. "Did you mean [huurder]" — right answer, no explanation. | ⚠️ |
| 11 | Type **gestegen** | **Unchanged, and now the worst thing in task 1.** [gisteren] [genoegen] [vestigen]: three wrong guesses, correct answer absent, online lookup suppressed behind a link. | ❌ |

**Verdict:** every account-shaped obstacle in this task is gone. What's left
is entirely about words — nothing carries the article in, and inflected words
fall into the suggestion trap.

## Task 2 — capture from a photo

Unchanged. No camera, no gallery picker, no OCR, no permission step; the task
has no path. The typed fallback still returns "attack / assault" for `aanslag`
and "to soak" for `weken` as single, uneditable meanings.

**Verdict:** ❌, unchanged. Keep the typed re-script until capture-from-image
ships.

## Task 3 — practice

| # | Step | What happened | |
| --- | --- | --- | --- |
| 1–2 | Start a session | Unchanged and good. | ✅ |
| 3 | Work out whether to flip first | **Unchanged.** Both grade buttons are live before the flip and nothing states the intended order. Now the most-noticeable rough edge in this task. | ⚠️ |
| 6 | Miss a card | Fixed in run 02's build; still correct here. | ✅ |
| 8 | Leave after missing a word | **Fixed.** The summary offers Back to dashboard alongside Review missed words, and it works. | ✅ |
| 10 | Quit halfway with the × | **Fixed.** Nothing is lost; the answers given are already saved and the dashboard reflects them immediately. No confirmation dialog is needed, because there's nothing to warn about. | ✅ |

**Verdict:** task 3 is now completable in every direction a participant might
take it. The remaining friction is the pre-flip ambiguity, which is a question
for real users rather than a defect.

---

## New this run

| Finding | Detail |
| --- | --- |
| **The practice log now has one row per attempt, not per word** | A word missed then recovered writes two rows (`dontKnow`, then `know`) where it previously wrote one. This is what the ladder was already doing — every attempt is graded — so the log and the schedule finally agree, and `user_practice_events` matches its documented "one row per flashcard answer". Anyone comparing pilot numbers across builds should know the denominator changed. |
| **"Not now" on Set a new password** | Deliberate: the recovery session is already valid, so someone who opened the link by accident isn't held on a screen they don't need. It does mean a participant can leave without setting a password and be no better off next time — acceptable, and preferable to a new dead-end. |
| **Google sign-in bypasses all of this** | Neither confirmation nor recovery applies to "Continue with Google". Not a defect; worth knowing when a participant picks that route and the pre-step's email instructions don't apply to them. |

## Still open

- No route from reading into the app (T1).
- No photo or OCR capture (T2).
- Silent wrong senses, with no way to edit a saved translation (T2).
- Inflected forms miss, and a near-match suppresses the online lookup (T1, T2).
- Pre-flip grading is possible and unexplained (T3).
- No "add another" — every save returns to the deck.
- Sign-up still requires leaving the app for an inbox; the step is now
  well-signposted, but the interruption is inherent to email confirmation.

---

## Revised task script

Unchanged from run 02 except the pre-step, which now says what the participant
is opening and drops the wording that implied an installed app. This is the
version in force for Study 2.

**Facilitator pre-step.** Woordkast is a web page, not an app from a store —
send the participant `<URL>` and have them open it in their phone browser.
There is nothing to install. Ask them to tap **Create an account** and
complete the email confirmation before the first task begins; if the email is
slow, the screen has a **Send it again** button. Confirm they land on a screen
saying "Add your first word".

**Task 1 — capture while reading.** *Here is a short Dutch news article, on
paper / in a second browser tab. Read it as you normally would. When you reach
a word you don't know and would want to remember, add that word to Woordkast,
then keep going. Add two or three words this way. Think aloud — especially if
the app shows you something you didn't expect.*

**Task 2 — capture from something in your life.** *Here is a letter from the
gemeente / a photo of a street sign. Pick out three words you don't recognise
and add them to Woordkast. When you see the meaning the app gives you, tell me
whether it matches what you think the word means here.*

**Task 3 — practice what you saved.** *Practise the words you've added. Work
through them the way you would on a normal day, and stop when you feel you're
done for now. Then tell me what you'd do next.*

The Task 3 recovery instruction from runs 01 and 02 — "reload the page" — is
**retired**. The summary screen has an exit, and quitting mid-session no
longer costs anything, so a participant who stops is exercising the app rather
than escaping it. Note where they choose to stop; that's now data, not a
rescue.

---

## Explicitly out of scope for this report

No completion rate, no task timing, and no usability or satisfaction
judgement. This run only validates that the script and happy path are
logically coherent. Real friction is measured in Study 2.
