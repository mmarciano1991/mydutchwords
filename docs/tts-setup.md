# Pronunciation — natural voice (Azure Speech)

Listening plays each word in a neural Dutch voice (default `nl-NL-FennaNeural`)
through the `tts` Supabase Edge Function. Without it — no Supabase project,
offline, or the function failing — the app falls back to the device's own
Dutch voice, so nothing breaks while this isn't set up.

Each word is synthesised once: the MP3 is cached in the private `tts` storage
bucket and served from there afterwards, so Azure is only billed for words no
one has heard yet. Azure's free tier (F0) covers 500,000 characters a month.

## Set up

1. **Azure.** In the Azure portal, create a *Speech* resource (Free F0 tier is
   fine). From *Keys and Endpoint*, copy **Key 1** and the **Location/Region**
   (e.g. `westeurope`).

2. **Secrets.** In the project root:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase secrets set AZURE_SPEECH_KEY=<key> AZURE_SPEECH_REGION=westeurope
   # optional, any nl-NL / nl-BE neural voice, e.g. nl-NL-MaartenNeural
   supabase secrets set AZURE_SPEECH_VOICE=nl-NL-FennaNeural
   ```

3. **Cache bucket.** Nothing to do: the function creates the private `tts`
   bucket the first time it saves a word. (`migrations/20261009120000_tts_cache.sql`
   creates it too, whenever migrations are next pushed.)

4. **Deploy the function.**

   ```bash
   supabase functions deploy tts
   ```

   `config.toml` deploys it with `verify_jwt = false`: the app works signed
   out, so calls carry only the public key. The function only accepts a short
   word or phrase (≤ 80 letters), which bounds what a stray caller can spend.

## Check it

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/tts" \
  -H "apikey: <publishable key>" -H "Content-Type: application/json" \
  -d '{"text":"fiets"}' -o fiets.mp3
```

An MP3 that says *fiets* means it works. Changing the voice later starts a
fresh cache (files are stored per voice).
