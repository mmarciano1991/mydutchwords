# Dictionary review — pilot

Reviewed **500** senses; tier 1 flagged **248** (50%).

| Category | Reviewed | Flagged |
|---|---|---|
| gloss | 100 | 98 |
| tatoeba | 150 | 46 |
| stored | 125 | 31 |
| other | 25 | 12 |
| wiktionary | 50 | 19 |
| no-example | 50 | 42 |

Problems flagged: bad-gloss 165, bad-translation 17, wrong-meaning 59, duplicate 17, ungrammatical 15, unnatural 6

Tier 2 outcome: **136** fixes, **71** drops, 30 kept as is (tier 1 was wrong), 11 proposals rejected by the checks.

## Cost

| Model | Requests | Input tokens | Output tokens |
|---|---|---|---|
| claude-haiku-5-5 | 176 | 154,853 | 134,099 |

Estimated cost (batch prices): **$0.041** — about $0.08 per 1,000 senses.

## Proposed changes (first 50)

- **hiernamaals** (adjective) “of” — bad-gloss
  - gloss → “hereafter (afterlife)”
  - example: ~~none~~ → Hij gelooft in het hiernamaals. (He believes in the afterlife.)
  - why: The gloss "of" is not a translation; the word means the afterlife or hereafter, and a short example shows that use.
- **kanjer** (noun) “something” — bad-gloss
  - rejected: gloss: more than one meaning
- **gerechtelijk** (adjective) “of” — bad-gloss
  - gloss → “judicial (legal)”
  - example: ~~none~~ → Hij heeft een gerechtelijke procedure gestart. (He started legal proceedings.)
  - why: The gloss "of" is wrong; the word means judicial or legal, and an example makes the court-related sense clear.
- **topper** (noun) “someone” — bad-gloss
  - gloss → “star (great person)”
  - why: "Someone" is too vague; the meaning is a star or top person, and the existing example and translation already illustrate it.
- **reëel** (adjective) “pertaining” — bad-gloss
  - DROP: The broken gloss "pertaining" points to a sense already covered by the other listed meanings (real, realistic, real numbers, inflation-corrected), so this entry only duplicates them.
- **vacuüm** (adjective) “in” — bad-gloss
  - gloss → “vacuum-packed”
  - example: ~~none~~ → Het vlees is vacuüm verpakt. (The meat is vacuum-packed.)
  - why: The gloss "in" is a meaningless fragment; this adjective sense is the real "vacuum-packed" usage, which is distinct from "empty", so it is kept with a new gloss and example.
- **Hollander** (adjective) “of” — bad-gloss
  - DROP: Hollander as an adjective is nonstandard and rare; learners should use the adjective Hollands, so this meaning only confuses.
- **schors** (noun) “one's” — bad-gloss
  - gloss → “tree bark”
  - example: ~~none~~ → De schors van de boom is ruw. (The bark of the tree is rough.)
  - why: The gloss "one's" is wrong; the meaning is the outer bark of a tree, so it gets a clear gloss and a simple example.
- **rozenkrans** (noun) “less commonly” — bad-gloss
  - DROP: This wreath-of-roses sense is archaic and obscure, and the gloss "less commonly" is not a translation; the common rosary meaning is already listed.
- **subject** (noun) “someone” — bad-gloss
  - gloss → “individual (derogatory)”
  - why: The gloss "someone" is a pronoun, not a translation; this sense is a suspicious person, so the gloss and translation are corrected while the Dutch example stays as it is.
- **Marker** (adjective) “of” — bad-gloss
  - DROP: The adjective 'marker' does not mean 'of' in Dutch, so this meaning does not exist for the word.
- **lelijkheid** (noun) “someone” — bad-gloss
  - gloss → “ugliness”
  - example: ~~none~~ → De lelijkheid van het gebouw valt meteen op. (The building's ugliness is noticed immediately.)
  - why: The gloss 'someone' is wrong, and 'ugliness' is the correct meaning, so an example is added to show it in use.
- **Perzisch** (adjective) “in” — bad-gloss
  - DROP: The only other meaning is 'Persian', which this item duplicates, and the gloss 'in' is not a valid translation.
- **universitair** (adjective) “of” — bad-gloss
  - gloss → “university-level”
  - why: The gloss 'of' is not a usable translation, and 'university-level' describes the adjective's meaning; the existing example and translation are already correct.
- **bef** (noun) “by analogy” — bad-gloss
  - gloss → “white collar bands”
  - example: ~~none~~ → De predikant droeg een witte bef. (The minister wore white collar bands.)
  - why: The gloss 'by analogy' is wrong, and this item's meaning is the white neckband of a clergyman or lawyer, so the gloss and an example are corrected to match it.
- **achenebbisj** (noun) “someone” — bad-gloss
  - gloss → “nobody (insignificant person)”
  - why: The gloss "someone" misses the pejorative sense of an insignificant or worthless person, so it is corrected and a new example is given.
- **Achterhoeks** (adjective) “of” — bad-gloss
  - gloss → “of the Achterhoek”
  - why: "Of" alone is meaningless; the adjective means belonging to the Achterhoek region, so the gloss is corrected and an example is added.
- **Akens** (adjective) “of” — bad-gloss
  - DROP: This is not a standard, reliably attested adjective with a clear meaning, so it would only confuse a learner.
- **Amsterdammer** (adjective) “of” — bad-gloss
  - gloss → “person from Amsterdam”
  - example: ~~none~~ → De Amsterdammer fietst elke dag naar zijn werk. (The Amsterdammer cycles to work every day.)
  - why: "Of" is not a meaning; the word is actually a noun for an inhabitant of Amsterdam, so the gloss and example are corrected (the part-of-speech label is wrong but cannot be changed here).
- **aprils** (adjective) “of” — bad-gloss
  - gloss → “like April (changeable)”
  - example: ~~none~~ → Wat een aprils weertje is het vandaag. (What changeable weather it is today.)
  - why: "Of" misses the meaning; the adjective means April-like, typically describing changeable weather, so the gloss and example are corrected.
- **Atlantisch** (adjective) “of” — bad-gloss
  - gloss → “Atlantic (relating to)”
  - why: The gloss "of" is a preposition, not a translation; "Atlantic" gives the meaning, and the existing example already fits.
- **Berlijner** (adjective) “of” — bad-gloss
  - gloss → “from Berlin”
  - why: The gloss "of" is meaningless, so it becomes "from Berlin", and an example is added to show the word in use.
- **beunhaas** (noun) “in particular” — bad-gloss
  - DROP: "In particular" is an adverb that does not translate this noun, and the real meanings (bungler, tradesman) are already listed, so this entry adds only confusion.
- **beurzensnijder** (noun) “hence metaphorically” — bad-gloss
  - DROP: "Hence metaphorically" is not a translation, and the only real meaning, purse-snatcher, is already listed as another meaning, so this is a duplicate.
- **bevindelijk** (adjective) “of” — bad-gloss
  - DROP: "Of" is not a translation, and the only real meaning, experiential, is already listed, while the word is obscure religious jargon that would only confuse a learner.
- **Botswaans** (adjective) “of” — bad-gloss
  - gloss → “Botswanan”
  - example: ~~none~~ → Het Botswaanse eten smaakt verrassend lekker. (Botswanan food tastes surprisingly good.)
  - why: The gloss "of" is not a translation; the adjective means Botswanan, so a proper gloss and example are needed.
- **Brussels** (adjective) “of” — bad-gloss
  - gloss → “of Brussels”
  - example: ~~none~~ → De Brusselse metro is erg druk vanochtend. (The Brussels metro is very busy this morning.)
  - why: The gloss "of" alone is meaningless; "of Brussels" states the meaning and the example shows the adjective use.
- **commanditair** (adjective) “Of” — bad-gloss
  - gloss → “limited (partnership)”
  - example: ~~none~~ → Die commanditaire vennootschap heeft drie vennoten. (That limited partnership has three partners.)
  - why: The gloss "Of" is capitalized and uninformative; the adjective describes a limited partnership, so the gloss and example should reflect that.
- **Corsicaans** (adjective) “in” — bad-gloss
  - DROP: The meaning "Corsican" is already listed as another meaning, so this item duplicates it and the gloss "in" is wrong.
- **cruijffiaans** (adjective) “of” — bad-gloss
  - gloss → “Cruijffian (paradoxical)”
  - example: ~~Ik geef u daarom het volgende cruijffiaanse advies mee: verzwijg alles waar u later spijt van zult krijgen.~~ → Zijn antwoord was typisch cruijffiaans: ja, maar ook nee. (His answer was typically Cruijffian: yes, but also no.)
  - why: The gloss "of" is wrong, and the existing example is too long and splits a separable verb, so a shorter natural example is needed.
- **Delfts** (adjective) “of” — bad-gloss
  - gloss → “from Delft”
  - example: ~~none~~ → Het Delfts blauwe servies staat in de kast. (The Delft blue tableware is in the cupboard.)
  - why: The gloss "of" is too vague, and the word means "from Delft"; the example is replaced with a clearer everyday sentence.
- **Diemer** (adjective) “of” — bad-gloss
  - DROP: This archaic, obscure adjective only confuses learners, so it should be removed.
- **dorps** (adjective) “pertaining” — bad-gloss
  - rejected: gloss: more than one meaning
- **Drents** (adjective) “of” — bad-gloss
  - gloss → “from Drenthe”
  - example: ~~Het Drents is een groep varianten van de Nedersaksische streektaal.~~ → Mijn oma spreekt een mooi Drents dialect. (My grandmother speaks a beautiful Drents dialect.)
  - why: "Of" is a bad gloss, and the existing example uses the noun meaning (the language), not the adjective, so both are replaced.
- **eenzaadlobbig** (adjective) “of” — bad-gloss
  - gloss → “monocotyledonous (botany)”
  - example: ~~none~~ → Grassen en lelies zijn eenzaadlobbig. (Grasses and lilies are monocotyledonous.)
  - why: "Of" is not a meaning, and the word is a real botanical adjective meaning monocotyledonous, so it is kept with a corrected gloss and a simple example.
- **energieslurper** (noun) “something” — bad-gloss
  - gloss → “energy guzzler”
  - example: ~~none~~ → Mijn oude wasmachine is een echte energieslurper. (My old washing machine is a real energy guzzler.)
  - why: The gloss 'something' is too vague; 'energy guzzler' names the meaning, and the example shows it in use.
- **energievreter** (noun) “something” — bad-gloss
  - gloss → “energy hog”
  - example: ~~none~~ → Deze oude koelkast is een energievreter. (This old fridge is an energy hog.)
  - why: The gloss 'something' is too vague; 'energy hog' is a distinct near-synonym, so it does not simply repeat item 1's gloss, and the example shows it in use.
- **exponent** (noun) “someone” — bad-gloss
  - rejected: gloss: more than one meaning
- **Faeröers** (adjective) “in” — bad-gloss
  - DROP: The gloss 'in' is wrong, and the only other meaning, 'Faroese', is the same as this meaning, so the entry duplicates itself.
- **filmisch** (adjective) “of” — bad-gloss
  - gloss → “cinematic”
  - example: ~~none~~ → Dit shot is erg filmisch. (This shot is very cinematic.)
  - why: The gloss 'of' is not a translation; 'cinematic' is the correct meaning, and a short example shows its use.
- **Gelders** (adjective) “Of” — bad-gloss
  - gloss → “of Gelderland”
  - example: ~~none~~ → Zij woont in een Gelderse boerderij. (She lives in a Gelderland farmhouse.)
  - why: The gloss "Of" is incomplete, so it should name the region the adjective refers to, and an example is needed.
- **geschiedfilosofisch** (adjective) “of” — bad-gloss
  - gloss → “philosophy of history”
  - example: ~~none~~ → Dit boek behandelt geschiedfilosofische vragen over vooruitgang. (This book deals with philosophy-of-history questions about progress.)
  - why: The gloss "of" is meaningless alone, so it should give the actual sense (relating to the philosophy of history) with an example.
- **Gouds** (adjective) “of” — bad-gloss
  - gloss → “of Gouda”
  - why: The gloss "of" does not say what the adjective means, so it should be "of Gouda" with an example.
- **Groenlands** (adjective) “in” — bad-gloss
  - DROP: The gloss "in" is wrong, and this meaning duplicates the separate Greenlandic meaning already listed for the word.
- **Groninger** (adjective) “of” — bad-gloss
  - gloss → “of Groningen”
  - example: ~~none~~ → Het Groninger accent is best herkenbaar. (The Groningen accent is quite recognizable.)
  - why: The gloss "of" is incomplete, so it should name Groningen, and an example is needed.
- **Gronings** (adjective) “of” — bad-gloss
  - gloss → “from Groningen”
  - example: ~~none~~ → Zijn Gronings accent is duidelijk hoorbaar. (His Groningen accent is clearly audible.)
  - why: The gloss "of" is too vague; "from Groningen" states the meaning, and the new example shows the adjective in use.
- **Haarlemmer** (adjective) “of” — bad-gloss
  - DROP: This archaic adjective form only confuses learners, since "Haarlems" is the normal form for this meaning.
- **Haarlems** (adjective) “of” — bad-gloss
  - gloss → “from Haarlem”
  - example: ~~none~~ → Wij bezoeken de Haarlemse markt op zaterdag. (We visit the Haarlem market on Saturday.)
  - why: The gloss "of" is too vague, so "from Haarlem" is clearer, and the example uses the inflected form "Haarlemse" correctly.
- **hoofdstedelijk** (adjective) “of” — bad-gloss
  - gloss → “of the capital”
  - why: The gloss "of" alone is too vague, and "of the capital" matches the existing example and translation.
- **IJslands** (adjective) “in” — bad-gloss
  - DROP: The meaning "Icelandic" is already listed as another meaning, so this entry duplicates it and the gloss "in" is wrong.
