-- Pronunciation cache for the tts Edge Function: one MP3 per voice and word.
-- Private — only the function (service role) reads and writes it; the app
-- gets audio through the function.
--
-- Safe to run more than once.

insert into storage.buckets (id, name, public)
values ('tts', 'tts', false)
on conflict (id) do nothing;
