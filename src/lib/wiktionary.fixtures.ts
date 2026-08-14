/* Recorded Wiktionary responses for wiktionary.test.ts — real shape, trimmed
   to what the parser actually reads. Captured from en.wiktionary.org on
   2026-08-14; see docs/pilot-readiness-report.md H3 for why this is a
   fixture rather than a live call in CI. */

/** `/page/definition/huis` — trimmed to the `nl` usages, two definitions per
 *  part of speech (enough to exercise dedup and the sense cap without
 *  reproducing the whole entry), with `parsedExamples` kept on the one
 *  definition that has any — most don't, which the "kat" case below covers. */
export const HUIS_DEFINITION_JSON = {
  nl: [
    {
      partOfSpeech: "Noun",
      language: "Dutch",
      definitions: [
        {
          definition:
            'a <a rel="mw:WikiLink" href="/wiki/house" title="house">house</a>, home; <a rel="mw:WikiLink" href="/wiki/residence" title="residence">residence</a>',
          parsedExamples: [
            {
              example: "Ik woon in een klein <b>huis</b> aan de rand van de stad.",
              translation: "I live in a small <b>house</b> on the outskirts of the city.",
            },
          ],
        },
        {
          definition:
            'an adjoining <a rel="mw:WikiLink" href="/wiki/building" title="building">building</a> with a separate function',
        },
      ],
    },
    {
      partOfSpeech: "Verb",
      language: "Dutch",
      definitions: [
        {
          definition:
            '<span class="form-of-definition use-with-mention">inflection of <span class="form-of-definition-link"><i class="Latn mention" lang="nl"><a rel="mw:WikiLink" href="/wiki/huizen#Dutch" title="huizen">huizen</a></i></span>:</span>',
        },
      ],
    },
  ],
};

/** `/page/html/huis` — trimmed to the two things `fetchGender` reads: the
 *  Dutch section's noun headword line, and (as a scoping check) an unrelated
 *  French homograph earlier on the same page with its own, different
 *  gender — proving the parser doesn't grab the first `.gender` on the page,
 *  only the one inside `#Dutch`. */
export const HUIS_HTML = `
<section data-mw-section-id="1" id="mwA"><h2 id="French">French</h2>
<section data-mw-section-id="2" id="mwB"><h3 id="Noun">Noun</h3>
<p><span class="headword-line"><strong class="Latn headword" lang="fr">maison</strong> <span class="gender"><abbr title="feminine gender">f</abbr></span></span></p>
</section></section>
<section data-mw-section-id="3" id="mwC"><h2 id="Dutch">Dutch</h2>
<section data-mw-section-id="4" id="mwD"><h3 id="Pronunciation">Pronunciation</h3>
<ul><li>IPA: /ɦœy̯s/</li></ul>
</section>
<section data-mw-section-id="5" id="mwE"><h4 id="Noun_3">Noun</h4>
<p id="mwG"><span class="headword-line"><strong class="Latn headword" lang="nl">huis</strong><span class="gender"><abbr title="neuter gender">n</abbr></span> (<i>plural</i> <b lang="nl"><a href="./huizen#Dutch">huizen</a></b>, <i>diminutive</i> <b lang="nl"><a href="./huisje#Dutch">huisje</a></b><span class="gender"><abbr title="neuter gender">n</abbr></span>)</span></p>
</section>
</section>
`;

/** `/page/definition/kat` — a noun with no authored usage examples at all
 *  (verified live: 0 `.h-usage-example` in its Dutch section), the common
 *  case this feature has to degrade gracefully for. */
export const KAT_DEFINITION_JSON = {
  nl: [
    {
      partOfSpeech: "Noun",
      language: "Dutch",
      definitions: [
        {
          definition: 'domestic <a rel="mw:WikiLink" href="/wiki/cat" title="cat">cat</a>',
        },
      ],
    },
  ],
};

/** `/page/html/kat` — has a gender (feminine → de) despite having no example. */
export const KAT_HTML = `
<section data-mw-section-id="1" id="mwA"><h2 id="Dutch">Dutch</h2>
<section data-mw-section-id="2" id="mwB"><h4 id="Noun_9">Noun</h4>
<p><span class="headword-line"><strong class="Latn headword" lang="nl">kat</strong><span class="gender"><abbr title="feminine gender">f</abbr></span> (<i>plural</i> <b lang="nl"><a href="./katten#Dutch">katten</a></b>)</span></p>
</section>
</section>
`;

/** `/page/definition/wandelen` — an adjective/verb-only entry, no noun
 *  sense at all: `fetchGender` should never be called for this one. */
export const WANDELEN_DEFINITION_JSON = {
  nl: [
    {
      partOfSpeech: "Verb",
      language: "Dutch",
      definitions: [{ definition: "to walk" }],
    },
  ],
};
