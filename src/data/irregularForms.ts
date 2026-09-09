/* Irregular Dutch forms — the ones no suffix rule can derive.
 *
 * Dutch inflection is mostly regular enough to strip with a rule (see
 * lib/deinflect), but a few groups aren't, and they're dense with exactly
 * the words a learner meets first:
 *
 *  - Strong verbs change their stem vowel rather than adding an ending
 *    (lopen → liep → gelopen), so no amount of suffix-stripping gets from
 *    the form back to the infinitive.
 *  - A handful of nouns pluralise by changing the stem (stad → steden) or
 *    by keeping a Latin ending (museum → musea).
 *  - The commonest comparatives are suppletive (goed → beter → best):
 *    a different word entirely, not an inflection.
 *
 * These are lookup tables, not rules: every key is an inflected form and
 * every value is the base form to look up. A value that isn't in the
 * bundled dictionary simply never matches, so an over-eager entry costs
 * nothing — deinflect confirms every candidate against the dictionary
 * before returning it (see that module's header).
 *
 * Preterites and participles are kept in SEPARATE tables purely so each can
 * report the right grammatical relation to the learner ("liep → lopen (past
 * tense)" vs. "gelopen → lopen (past participle)"). Where a verb's plural
 * preterite and its participle are spelled identically ("verdwenen",
 * "begonnen", "besloten"), the form is listed once, under participles.
 *
 * Separable-prefix forms are deliberately NOT listed: "opgenomen",
 * "aangekomen" and "meegebracht" are handled by a rule in deinflect that
 * peels the prefix and recurses into these tables for the rest, so listing
 * them would mean listing every prefix × every verb.
 *
 * Extend any table by adding an entry — no build step.
 */

/** Irregular PRESENT TENSE forms → infinitive. Only the verbs whose present
 *  can't be reached by the regular stem rules in deinflect are listed: "ik
 *  ga" has no "g" stem to add "-en" to, and "heeft" is not "heef" + t. These
 *  are also the most frequent verbs in the language, so their absence was
 *  felt out of all proportion to the size of this table. */
export const IRREGULAR_PRESENTS: Record<string, string> = {
  ben: "zijn",
  bent: "zijn",
  is: "zijn",
  heb: "hebben",
  hebt: "hebben",
  heeft: "hebben",
  ga: "gaan",
  gaat: "gaan",
  sta: "staan",
  staat: "staan",
  doe: "doen",
  doet: "doen",
  zie: "zien",
  ziet: "zien",
  sla: "slaan",
  slaat: "slaan",
  kan: "kunnen",
  kun: "kunnen",
  kunt: "kunnen",
  zal: "zullen",
  zult: "zullen",
  wil: "willen",
  wilt: "willen",
  mag: "mogen",
  moet: "moeten",
  weet: "weten",
  hou: "houden",
  houdt: "houden",
  zegt: "zeggen",
  legt: "leggen",
  ligt: "liggen",
  zit: "zitten",
};

/** Strong and irregular PAST TENSE forms (singular and plural) → infinitive.
 *  Grouped by ablaut class, so a missing sibling is easy to spot. */
export const IRREGULAR_PRETERITES: Record<string, string> = {
  // — auxiliaries and modals —
  was: "zijn",
  waren: "zijn",
  had: "hebben",
  hadden: "hebben",
  werd: "worden",
  werden: "worden",
  kon: "kunnen",
  konden: "kunnen",
  zou: "zullen",
  zouden: "zullen",
  wou: "willen",
  wilde: "willen",
  wilden: "willen",
  mocht: "mogen",
  mochten: "mogen",
  moest: "moeten",
  moesten: "moeten",

  // — ij → ee (schrijven class) —
  bleef: "blijven",
  bleven: "blijven",
  schreef: "schrijven",
  schreven: "schrijven",
  keek: "kijken",
  keken: "kijken",
  reed: "rijden",
  reden: "rijden",
  sneed: "snijden",
  sneden: "snijden",
  leek: "lijken",
  leken: "lijken",
  kreeg: "krijgen",
  kregen: "krijgen",
  steeg: "stijgen",
  stegen: "stijgen",
  zweeg: "zwijgen",
  zwegen: "zwijgen",
  beet: "bijten",
  beten: "bijten",
  gleed: "glijden",
  gleden: "glijden",
  wees: "wijzen",
  wezen: "wijzen",
  scheen: "schijnen",
  schenen: "schijnen",
  greep: "grijpen",
  grepen: "grijpen",
  rees: "rijzen",
  rezen: "rijzen",
  verdween: "verdwijnen",
  begreep: "begrijpen",
  vergeleek: "vergelijken",
  bewees: "bewijzen",
  verwees: "verwijzen",
  vermeed: "vermijden",
  overleed: "overlijden",

  // — ie/ui → oo (sluiten class) —
  bood: "bieden",
  boden: "bieden",
  verbood: "verbieden",
  vloog: "vliegen",
  vlogen: "vliegen",
  verloor: "verliezen",
  koos: "kiezen",
  kozen: "kiezen",
  schoot: "schieten",
  schoten: "schieten",
  sloot: "sluiten",
  sloten: "sluiten",
  besloot: "besluiten",
  genoot: "genieten",
  goot: "gieten",
  goten: "gieten",

  // — e → a → o (spreken class) —
  sprak: "spreken",
  spraken: "spreken",
  brak: "breken",
  braken: "breken",
  stak: "steken",
  staken: "steken",
  nam: "nemen",
  namen: "nemen",
  kwam: "komen",
  kwamen: "komen",
  trof: "treffen",
  troffen: "treffen",
  stierf: "sterven",
  stierven: "sterven",
  hielp: "helpen",
  hielpen: "helpen",
  trok: "trekken",
  trokken: "trekken",

  // — e → a → e (geven class) —
  gaf: "geven",
  gaven: "geven",
  las: "lezen",
  lazen: "lezen",
  at: "eten",
  aten: "eten",
  vergat: "vergeten",
  vergaten: "vergeten",
  zat: "zitten",
  zaten: "zitten",
  lag: "liggen",
  lagen: "liggen",
  bad: "bidden",
  baden: "bidden",
  zag: "zien",
  zagen: "zien",

  // — nasal class (i → o) —
  begon: "beginnen",
  won: "winnen",
  zong: "zingen",
  zongen: "zingen",
  dronk: "drinken",
  vond: "vinden",
  vonden: "vinden",
  bond: "binden",
  bonden: "binden",
  klonk: "klinken",
  sprong: "springen",
  dwong: "dwingen",
  zonk: "zinken",
  schonk: "schenken",
  zwom: "zwemmen",

  // — the "-cht" group (a weak ending on a changed stem) —
  dacht: "denken",
  dachten: "denken",
  bracht: "brengen",
  brachten: "brengen",
  kocht: "kopen",
  kochten: "kopen",
  verkochten: "verkopen",
  zocht: "zoeken",
  zochten: "zoeken",

  // — ie preterites (lopen class) —
  liep: "lopen",
  liepen: "lopen",
  riep: "roepen",
  riepen: "roepen",
  sliep: "slapen",
  sliepen: "slapen",
  liet: "laten",
  lieten: "laten",
  verliet: "verlaten",
  verlieten: "verlaten",
  hield: "houden",
  hielden: "houden",
  viel: "vallen",
  vielen: "vallen",
  hing: "hangen",
  hingen: "hangen",
  ving: "vangen",
  vingen: "vangen",
  ontving: "ontvangen",
  ontvingen: "ontvangen",
  blies: "blazen",
  bliezen: "blazen",

  // — oe preterites (dragen class) —
  droeg: "dragen",
  droegen: "dragen",
  sloeg: "slaan",
  sloegen: "slaan",
  vroeg: "vragen",
  vroegen: "vragen",
  voer: "varen",
  voeren: "varen",
  groef: "graven",
  groeven: "graven",

  // — the irregular monosyllables —
  ging: "gaan",
  gingen: "gaan",
  stond: "staan",
  stonden: "staan",
  bestond: "bestaan",
  bestonden: "bestaan",
  ontstond: "ontstaan",
  ontstonden: "ontstaan",
  verstond: "verstaan",
  verstonden: "verstaan",
  deed: "doen",
  deden: "doen",
  wist: "weten",
  wisten: "weten",
  zei: "zeggen",
  zeiden: "zeggen",
  legde: "leggen",
  legden: "leggen",
  trad: "treden",
  traden: "treden",
};

/** Strong and irregular PAST PARTICIPLES → infinitive. Includes the forms
 *  that double as a plural preterite (see the module header). */
export const IRREGULAR_PARTICIPLES: Record<string, string> = {
  // — auxiliaries and modals —
  geweest: "zijn",
  gehad: "hebben",
  geworden: "worden",
  gekund: "kunnen",
  gewild: "willen",
  gemogen: "mogen",
  gemoeten: "moeten",

  // — ij → e (schrijven class) —
  gebleven: "blijven",
  geschreven: "schrijven",
  gekeken: "kijken",
  gereden: "rijden",
  gesneden: "snijden",
  geleken: "lijken",
  gekregen: "krijgen",
  gestegen: "stijgen",
  gezwegen: "zwijgen",
  gebeten: "bijten",
  gegleden: "glijden",
  gewezen: "wijzen",
  geschenen: "schijnen",
  gegrepen: "grijpen",
  gerezen: "rijzen",
  verdwenen: "verdwijnen",
  begrepen: "begrijpen",
  vergeleken: "vergelijken",
  bewezen: "bewijzen",
  verwezen: "verwijzen",
  vermeden: "vermijden",
  overleden: "overlijden",

  // — ie/ui → o (sluiten class) —
  geboden: "bieden",
  verboden: "verbieden",
  gevlogen: "vliegen",
  verloren: "verliezen",
  gekozen: "kiezen",
  geschoten: "schieten",
  gesloten: "sluiten",
  besloten: "besluiten",
  genoten: "genieten",
  gegoten: "gieten",

  // — e → o (spreken class) —
  gesproken: "spreken",
  gebroken: "breken",
  gestoken: "steken",
  genomen: "nemen",
  gekomen: "komen",
  getroffen: "treffen",
  gestorven: "sterven",
  geholpen: "helpen",
  getrokken: "trekken",

  // — e → e (geven class) —
  gegeven: "geven",
  gelezen: "lezen",
  gegeten: "eten",
  gezeten: "zitten",
  gelegen: "liggen",
  gebeden: "bidden",
  gezien: "zien",

  // — nasal class —
  begonnen: "beginnen",
  gewonnen: "winnen",
  gezongen: "zingen",
  gedronken: "drinken",
  gevonden: "vinden",
  gebonden: "binden",
  geklonken: "klinken",
  gesprongen: "springen",
  gedwongen: "dwingen",
  gezonken: "zinken",
  geschonken: "schenken",
  gezwommen: "zwemmen",

  // — the "-cht" group —
  gedacht: "denken",
  gebracht: "brengen",
  gekocht: "kopen",
  verkocht: "verkopen",
  gezocht: "zoeken",

  // — lopen class —
  gelopen: "lopen",
  geroepen: "roepen",
  geslapen: "slapen",
  gelaten: "laten",
  gehouden: "houden",
  gevallen: "vallen",
  gehangen: "hangen",
  gevangen: "vangen",
  geblazen: "blazen",

  // — dragen class —
  gedragen: "dragen",
  geslagen: "slaan",
  gevraagd: "vragen",
  gevaren: "varen",
  gegraven: "graven",

  // — the irregular monosyllables —
  gegaan: "gaan",
  gestaan: "staan",
  gedaan: "doen",
  geweten: "weten",
  gezegd: "zeggen",
  gelegd: "leggen",
  getreden: "treden",
  gelachen: "lachen",
  gescheiden: "scheiden",
  gewassen: "wassen",
  toegenomen: "toenemen",
};

/** Nouns whose plural changes the stem, or keeps a foreign ending. The
 *  regular "-en"/"-s"/"-eren" rules in deinflect handle everything else. */
export const IRREGULAR_PLURALS: Record<string, string> = {
  steden: "stad",
  schepen: "schip",
  leden: "lid",
  smeden: "smid",
  dagen: "dag",
  wegen: "weg",
  slagen: "slag",
  daken: "dak",
  gaten: "gat",
  glazen: "glas",
  vaten: "vat",
  bladeren: "blad",
  kinderen: "kind",
  eieren: "ei",
  liederen: "lied",
  volkeren: "volk",
  goederen: "goed",
  runderen: "rund",
  musea: "museum",
  gymnasia: "gymnasium",
  musici: "musicus",
  politici: "politicus",
  historici: "historicus",
  technici: "technicus",
};

/** Suppletive comparatives — a different word, not an ending. */
export const IRREGULAR_COMPARATIVES: Record<string, string> = {
  beter: "goed",
  meer: "veel",
  minder: "weinig",
  liever: "graag",
  erger: "erg",
};

/** Suppletive superlatives, bare and inflected. */
export const IRREGULAR_SUPERLATIVES: Record<string, string> = {
  best: "goed",
  beste: "goed",
  meest: "veel",
  meeste: "veel",
  minst: "weinig",
  minste: "weinig",
  liefst: "graag",
  liefste: "graag",
  ergst: "erg",
  ergste: "erg",
};

/** Separable verb prefixes. A separable verb writes its participle with
 *  "ge-" tucked inside the compound ("opgenomen", not "geopnemen"), so
 *  deinflect peels one of these, deinflects the rest, and puts it back. */
export const SEPARABLE_PREFIXES: readonly string[] = [
  "aan",
  "achter",
  "af",
  "bij",
  "binnen",
  "buiten",
  "deel",
  "dicht",
  "door",
  "in",
  "langs",
  "los",
  "mee",
  "na",
  "neer",
  "om",
  "onder",
  "op",
  "over",
  "plaats",
  "samen",
  "terug",
  "tegen",
  "toe",
  "uit",
  "vast",
  "voor",
  "vooruit",
  "weg",
];
