# Examples on demand — setup

Dictionary senses that shipped without an example ("Example coming soon")
get one written the first time a learner saves them, by the `example`
Supabase Edge Function. Without it — no Supabase project, no key, offline —
the card keeps saying "Example coming soon" and nothing breaks.

See [dictionary.md](dictionary.md#examples-on-demand) for how it works.

## Set up

1. **Claude API key.** Create one at console.anthropic.com.

2. **Secret.** In the project root:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase secrets set ANTHROPIC_API_KEY=<key>
   # optional, a different model
   supabase secrets set EXAMPLE_MODEL=claude-haiku-5-5
   ```

3. **Tables.** Push the migration that creates `dict_generated_examples`
   and `dict_example_attempts`:

   ```bash
   supabase db push
   ```

4. **Deploy the function.**

   ```bash
   supabase functions deploy example
   ```

   `config.toml` deploys it with `verify_jwt = false`, like `tts`: the app
   works signed out. It only accepts ids of senses that exist in the
   dictionary, writes each sense's sentence once, and stops after three
   failed attempts per sense, which bounds what a stray caller can spend.

## Check it

Pick a sense id with no example (any card showing "Example coming soon";
its id starts with `s_`):

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/example" \
  -H "apikey: <publishable key>" -H "Content-Type: application/json" \
  -d '{"senseId":"s_..."}'
```

`{"nl": "...", "en": "...", ...}` means it works; asking again returns the
same sentence from the table, without a model call.
