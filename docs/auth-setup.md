# Accounts & cloud sync (Supabase) — setup

Woordkast works fully offline with no account. Cloud sync is **optional**: set
up a free Supabase project, drop two values into an `.env` file, and users can
save their deck + progress to a profile (email/password or "Continue with
Google") and sync it across devices.

Until you add the two env values, none of the account UI appears and the app
behaves exactly as before.

---

## 1. Create the Supabase project (~3 min)

1. Sign up at <https://supabase.com> and create a new project (any region;
   the free tier is plenty).
2. When it's ready, go to **Project Settings → API** and copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   (The anon key is meant to live in frontend code — Row-Level Security is
   what protects the data.)

## 2. Create the database table

The schema lives as a migration in [`supabase/migrations/`](../supabase/migrations/)
(`user_state` table + per-user security policies), so you have two options:

- **Automatic (recommended):** with the **Supabase GitHub integration**
  connected to this repo, the migration is applied for you — to a preview
  branch on each PR, and to production when it merges to your production
  branch. Nothing to run by hand.
- **Manual fallback:** open **SQL Editor**, paste the contents of the
  migration file, and click **Run** (or run `supabase db push` with the CLI).

## 3. Enable Google sign-in (~5 min)

1. In **Google Cloud Console** → *APIs & Services → Credentials*, create an
   **OAuth client ID** of type *Web application*.
2. Under **Authorized redirect URIs**, add the callback shown in Supabase at
   **Authentication → Providers → Google** (it looks like
   `https://<your-project-ref>.supabase.co/auth/v1/callback`).
3. Copy the generated **Client ID** and **Client secret** into that Supabase
   Google provider panel and enable it.

> Email/password sign-in is on by default — no extra setup. New sign-ups get a
> confirmation email unless you turn that off under
> **Authentication → Providers → Email**.

## 4. Tell Supabase where the app lives

Under **Authentication → URL Configuration**:

- **Site URL**: your production URL (your Hostinger domain, e.g.
  `https://woordkast.example.com`).
- **Redirect URLs**: add the same production URL, plus
  `http://localhost:5173` for local development.

This is required so Google sign-in is allowed to return to your site.

## 5. Add the env values and build

Create a `.env` file at the repo root (copy `.env.example`):

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

Then build:

```bash
npm run build
```

`.env` is git-ignored. The values are baked into the static bundle at build
time, so **rebuild after changing them**.

## 6. Deploy to Hostinger

Woordkast is a static site — nothing server-side runs on Hostinger.

1. `npm run build` produces a `dist/` folder.
2. Upload the **contents of `dist/`** into `public_html` (via hPanel File
   Manager or FTP).
3. Make sure your domain has SSL enabled (Hostinger → SSL) — Google sign-in
   requires HTTPS.

That's it. The browser talks to Supabase directly over HTTPS; Hostinger just
serves the files.

---

## How sync behaves

- **Offline-first.** Logged out, everything stays in `localStorage` exactly as
  before. Nothing is sent anywhere.
- **On login**, the app pulls the profile's saved snapshot, merges it with
  whatever is on the device (union of words; the more-practised copy wins a
  conflict; the practice-result log is combined losslessly), applies the
  result, and saves it back. So signing in on a new device doesn't wipe local
  progress, and vice-versa.
- **While signed in**, changes are saved to the profile automatically
  (debounced) as you practise.
- **On sign-out**, the local session is cleared for privacy; signing back in
  restores everything from the profile.
