/* Real-world texts — short, typical passages from the letters and messages a
   learner in the Netherlands actually has to read. The monthly "then vs now"
   reflection measures how much of each the learner could read 30 days ago
   against how much they can read today, so progress is shown as something
   they can DO rather than as a count.

   Written to be representative, not copied from any real document. */
export interface RealText {
  id: string;
  /** "your belastingbrief" — reads after "of". */
  name: string;
  text: string;
}

export const REAL_TEXTS: RealText[] = [
  {
    id: "belastingbrief",
    name: "a belastingbrief",
    text:
      "Geachte heer, mevrouw, U ontvangt deze brief omdat u een aanslag inkomstenbelasting krijgt. " +
      "Het bedrag moet u binnen de termijn betalen. De datum staat op de aanslag. " +
      "Bent u het niet eens met het bedrag? Dan kunt u bezwaar maken. " +
      "Vul daarvoor het formulier in en stuur het binnen zes weken terug. " +
      "Heeft u een vraag over uw inkomen of de belasting? Bel ons of kijk op de website.",
  },
  {
    id: "huurbrief",
    name: "a letter from your landlord",
    text:
      "Beste huurder, Per één juli verandert de huur van uw woning. " +
      "De nieuwe huur is hoger dan vorig jaar. U betaalt het bedrag elke maand vóór de eerste dag. " +
      "Heeft u een vraag of wilt u een afspraak maken? Neem dan contact op met de verhuurder. " +
      "Bent u het niet eens met de verhoging, dan kunt u bezwaar maken bij de huurcommissie.",
  },
  {
    id: "gemeente",
    name: "a letter from the gemeente",
    text:
      "Beste bewoner, De gemeente werkt volgende week aan uw straat. " +
      "Op maandag en dinsdag kunt u uw auto niet voor de deur parkeren. " +
      "Uw fiets mag in de stalling bij het station. Afval wordt op een andere dag opgehaald. " +
      "Heeft u vragen? Kijk op de website of bel tijdens kantooruren.",
  },
];

/* Function words a reader already handles in context — they are excluded
   from the coverage percentage, which otherwise mostly measures whether
   the learner happened to put "de" in their deck. */
export const FUNCTION_WORDS = new Set(
  (
    "de het een en of maar dan dat die dit deze als om op in aan bij met van voor naar uit tot door over onder " +
    "na tegen zonder per niet geen wel ook nog al er hier daar waar wat wie hoe ze zij hij ik je jij u uw we wij " +
    "jullie hun hem haar mij me ons onze mijn zijn is was ben bent zijn heeft hebt heb had hebben wordt worden " +
    "werd kan kunt kunnen moet moeten mag mogen wil wilt willen zal zult zullen zou zouden te dan daarvoor dus " +
    "omdat elke elk één twee zes eerste andere nieuwe niet"
  ).split(" ")
);
