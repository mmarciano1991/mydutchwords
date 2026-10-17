/* About — what Woordkast is built from, with the attribution each source's
   licence asks for. Opened from Settings.

   The dictionary is derived from Wiktionary (CC BY-SA), whose share-alike
   terms cover the dictionary data in turn; Tatoeba (CC BY) asks for
   attribution; OpenTaal and the frequency list likewise. Keep this list in
   step with docs/dictionary.md, "Sources". */
import { Appbar } from "../components/Appbar";

interface Credit {
  name: string;
  what: string;
  licence: string;
  licenceUrl: string;
  url: string;
}

const DATA: Credit[] = [
  {
    name: "English Wiktionary",
    what: "Meanings, articles, plurals, verb forms and example sentences (via the kaikki.org extract).",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    url: "https://en.wiktionary.org/",
  },
  {
    name: "Dutch Wiktionary",
    what: "A second opinion on articles, plurals and verb forms, and translations (via kaikki.org).",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    url: "https://nl.wiktionary.org/",
  },
  {
    name: "Tatoeba",
    what: "Example sentences with their English translations.",
    licence: "CC BY 2.0 FR",
    licenceUrl: "https://creativecommons.org/licenses/by/2.0/fr/",
    url: "https://tatoeba.org/",
  },
  {
    name: "OpenTaal",
    what: "The official Dutch word list, used to check spelling.",
    licence: "BSD / CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    url: "https://www.opentaal.org/",
  },
  {
    name: "FrequencyWords (OpenSubtitles)",
    what: "How common each word is, for ranking search suggestions.",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    url: "https://github.com/hermitdave/FrequencyWords",
  },
  {
    name: "FreeDict Dutch–English",
    what: "Part of the word list in early versions of Woordkast, kept for cards saved back then.",
    licence: "GPL / CC BY-SA",
    licenceUrl: "https://freedict.org/",
    url: "https://freedict.org/",
  },
];

const SOFTWARE: Credit[] = [
  {
    name: "React",
    what: "The interface.",
    licence: "MIT",
    licenceUrl: "https://github.com/facebook/react/blob/main/LICENSE",
    url: "https://react.dev/",
  },
  {
    name: "Supabase client",
    what: "Accounts, sync and the dictionary service.",
    licence: "MIT",
    licenceUrl: "https://github.com/supabase/supabase-js/blob/master/LICENSE",
    url: "https://supabase.com/",
  },
  {
    name: "Spectral and Hanken Grotesk",
    what: "The typefaces.",
    licence: "SIL Open Font License 1.1",
    licenceUrl: "https://openfontlicense.org/",
    url: "https://fonts.google.com/",
  },
];

function CreditList({ items }: { items: Credit[] }) {
  return (
    <ul className="about-list">
      {items.map((c) => (
        <li key={c.name} className="about-item">
          <a className="about-item__name" href={c.url} target="_blank" rel="noopener">
            {c.name}
          </a>
          <p className="about-item__what">{c.what}</p>
          <a className="about-item__licence" href={c.licenceUrl} target="_blank" rel="noopener">
            {c.licence}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function About({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen">
      <Appbar title="About & licences" onBack={onBack} />
      <div className="screen__body gutter about-body">
        <p className="about-intro">
          Woordkast {__APP_VERSION__}. The dictionary is built from open sources, and is itself
          shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.
          Some example sentences are written by an AI model and are labelled as such.
        </p>

        <h2 className="about-heading">Dictionary sources</h2>
        <CreditList items={DATA} />

        <h2 className="about-heading">Software and typefaces</h2>
        <CreditList items={SOFTWARE} />

        <p className="about-foot">
          <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener">
            Privacy policy
          </a>
        </p>
      </div>
    </div>
  );
}
