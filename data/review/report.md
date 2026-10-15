# Dictionary review — pilot

Reviewed **500** senses; tier 1 flagged **246** (49%).

| Category | Reviewed | Flagged |
|---|---|---|
| gloss | 100 | 99 |
| tatoeba | 150 | 52 |
| stored | 125 | 28 |
| other | 25 | 11 |
| wiktionary | 50 | 16 |
| no-example | 50 | 40 |

Problems flagged: bad-gloss 166, duplicate 10, bad-translation 21, wrong-meaning 56, ungrammatical 22, unnatural 8

Tier 2 outcome: **119** fixes, **47** drops, 21 kept as is (tier 1 was wrong), 59 proposals rejected by the checks.

## Cost

| Model | Requests | Input tokens | Output tokens |
|---|---|---|---|
| claude-haiku-5-5 | 144 | 104,037 | 28,342 |
| claude-sonnet-5-5 | 246 | 197,673 | 27,434 |

Estimated cost (batch prices): **$0.347** — about $0.69 per 1,000 senses.

## Proposed changes (first 50)

- **hiernamaals** (adjective) “of” — bad-gloss
  - rejected: example: second model disagreed
- **kanjer** (noun) “something” — bad-gloss
  - gloss → “whopper (big one)”
  - why: The gloss 'something' is vague; 'kanjer' means a big or impressive specimen, and the example already fits this meaning.
- **gerechtelijk** (adjective) “of” — bad-gloss
  - gloss → “judicial”
  - example: ~~none~~ → Er is een gerechtelijk onderzoek tegen het bedrijf gestart. (A judicial investigation has been started against the company.)
  - why: The gloss "of" is meaningless; "judicial" is the core meaning of gerechtelijk, distinct from the other meaning "forensic", and an example is added.
- **topper** (noun) “someone” — bad-gloss
  - rejected: example: too short, word not found in sentence
- **reëel** (adjective) “pertaining” — bad-gloss, duplicate
  - DROP: The gloss "pertaining" is vague and incomplete, and the sense of pertaining to real numbers is already covered by another meaning, so this entry is a duplicate.
- **vacuüm** (adjective) “in” — bad-gloss
  - gloss → “vacuum-packed”
  - example: ~~none~~ → De koffie zit in een vacuüm verpakte zak. (The coffee comes in a vacuum-packed bag.)
  - why: The gloss "in" is meaningless; as an adjective vacuüm means airless or sealed under vacuum, which is distinct from "empty", so it needs a proper gloss and an example.
- **Hollander** (adjective) “of” — bad-gloss
  - DROP: Hollander is a noun (a person from Holland), not an adjective, and the gloss "of" is meaningless; the adjective form is "Hollands", so this meaning does not exist.
- **schors** (noun) “one's” — bad-gloss
  - DROP: The gloss "one's" is not a meaning of "schors" (bark, crust); the real senses are already covered by the other meanings, so this entry is spurious.
- **rozenkrans** (noun) “less commonly” — bad-gloss
  - DROP: The gloss "less commonly" is not a translation, and the meanings it could stand for (wreath of roses, rosary) are already listed, while the plant, youth and virginity senses are not real senses of rozenkrans, so this entry is a duplicate or invalid.
- **subject** (noun) “someone” — bad-gloss, duplicate
  - gloss → “individual (derogatory)”
  - example: ~~Er liep een verdacht subject door de straat.~~ → Er liep een verdacht subject door de straat. (A suspicious individual was walking down the street.)
  - why: "Someone" is too vague; in Dutch "subject" as a person means a dubious individual or character, which is distinct from the topic, grammatical subject, and ego meanings, so it is not a duplicate.
- **Marker** (adjective) “of” — bad-gloss
  - DROP: "Marker" is not an adjective in Dutch (it is a noun meaning marker pen or a place name), and the gloss "of" is meaningless, so this adjective meaning does not exist.
- **lelijkheid** (noun) “someone” — bad-gloss
  - DROP: The gloss "someone" is wrong for "lelijkheid", which means ugliness or unpleasant behaviour, both already covered by the other meanings, so this entry should be removed.
- **incluis** (adjective) “including” — bad-gloss
  - gloss → “included”
  - why: "Incluis" is used postpositively to mean 'included' (ontbijt incluis = breakfast included), so the gloss 'including' is inaccurate while the example is fine.
- **Perzisch** (adjective) “in” — bad-gloss
  - DROP: The gloss "in" is wrong for Perzisch, and the only valid meaning, "Persian", is already listed as another meaning, so this entry is a bad duplicate.
- **universitair** (adjective) “of” — bad-gloss
  - gloss → “university (adj.)”
  - why: The gloss "of" is meaningless; the adjective means relating to a university, and the example is fine.
- **bef** (noun) “by analogy” — bad-gloss
  - DROP: "By analogy" is not a meaning of "bef"; it looks like a stray sense from a different entry, and the real senses (collar tabs, vulva, etc.) are already covered by the other meanings.
- **achenebbisj** (noun) “someone” — bad-gloss
  - gloss → “poor fellow”
  - example: ~~none~~ → Die achenebbisj heeft zijn hele portemonnee verloren. (That poor fellow lost his whole wallet.)
  - why: Achenebbisj (from Yiddish) means a pitiful, unfortunate person, not simply 'someone', so the gloss was wrong and an example helps.
- **Achterhoeks** (adjective) “of” — bad-gloss
  - gloss → “of the Achterhoek”
  - example: ~~none~~ → Ze spreekt met een Achterhoeks accent. (She speaks with an Achterhoek accent.)
  - why: The gloss "of" is meaningless; Achterhoeks means relating to the Achterhoek region, and an example is added since none existed.
- **Akens** (adjective) “of” — bad-gloss
  - gloss → “of Aachen”
  - why: "Akens" is the adjective meaning 'of or from Aachen', and the gloss "of" is too vague to convey that.
- **Amsterdammer** (adjective) “of” — bad-gloss
  - rejected: example: word not found in sentence
- **aprils** (adjective) “of” — bad-gloss
  - gloss → “April-like (of April)”
  - example: ~~none~~ → Het aprilse weer is vandaag weer erg wisselvallig. (The April weather is very changeable again today.)
  - why: The gloss "of" is meaningless; "aprils" is an adjective meaning of or like April, typically describing changeable weather, and an example was missing.
- **Atlantisch** (adjective) “of” — bad-gloss
  - gloss → “Atlantic”
  - why: The gloss 'of' is meaningless; the adjective Atlantisch means 'Atlantic', and the existing example is fine.
- **Berlijner** (adjective) “of” — bad-gloss
  - rejected: example: second model disagreed
- **beunhaas** (noun) “in particular” — bad-gloss
  - DROP: "In particular" is not a meaning of beunhaas, which means a bungler or unlicensed amateur tradesman, so this entry is wrong and the real senses are already covered.
- **beurzensnijder** (noun) “hence metaphorically” — bad-gloss
  - gloss → “swindler”
  - example: ~~none~~ → Die beurzensnijder heeft veel oudere mensen om hun spaargeld gebracht. (That swindler cheated many elderly people out of their savings.)
  - why: The gloss "hence metaphorically" is a usage note rather than a translation; the figurative sense of beurzensnijder is a swindler or crook, distinct from the literal purse-snatcher.
- **bevindelijk** (adjective) “of” — bad-gloss
  - gloss → “pietistic (Reformed)”
  - example: ~~none~~ → Hij komt uit een bevindelijk gereformeerd gezin. (He comes from a devout, experiential Reformed family.)
  - why: The gloss "of" is meaningless; bevindelijk in this sense describes a strict Reformed piety based on personal religious experience, distinct from the general 'experiential' meaning.
- **Botswaans** (adjective) “of” — bad-gloss
  - rejected: example: second model disagreed
- **Brussels** (adjective) “of” — bad-gloss
  - rejected: example: second model disagreed
- **commanditair** (adjective) “Of” — bad-gloss
  - gloss → “limited (partnership)”
  - example: ~~none~~ → Het bedrijf is een commanditaire vennootschap met één stille vennoot. (The company is a limited partnership with one silent partner.)
  - why: The gloss 'Of' is meaningless; 'commanditair' is used for a limited partnership (commanditaire vennootschap), so a proper gloss and example are needed.
- **Corsicaans** (adjective) “in” — bad-gloss
  - rejected: example: second model disagreed
- **cruijffiaans** (adjective) “of” — bad-gloss
  - gloss → “Cruyffian (like Johan Cruijff)”
  - why: The gloss "of" is meaningless; the adjective means characteristic of or relating to Johan Cruijff, so "Cruyffian" with a short explanation fits, and the existing example is fine.
- **Delfts** (adjective) “of” — bad-gloss
  - gloss → “of Delft”
  - example: ~~none~~ → Ik heb een Delfts blauw bord gekocht. (I bought a Delft blue plate.)
  - why: The gloss "of" is incomplete; the adjective Delfts means 'of Delft' or 'from Delft', and an example sentence is added.
- **Diemer** (adjective) “of” — bad-gloss
  - DROP: "Diemer" is a proper-noun-derived form (relating to Diemen or the Diemermeer), not a real archaic adjective meaning "of", and with no other meanings or example there is nothing to salvage.
- **dorps** (adjective) “pertaining” — bad-gloss
  - gloss → “village-like (provincial)”
  - example: ~~none~~ → Het was een dorps café met vaste gasten. (It was a village-style pub with regular customers.)
  - why: The gloss "pertaining" is vague; "dorps" means village-like or provincial, and an example is added to show this.
- **Drents** (adjective) “of” — bad-gloss
  - gloss → “of Drenthe”
  - example: ~~Het Drents is een groep varianten van de Nedersaksische streektaal.~~ → Het Drentse landschap is vlak en heel rustig. (The Drents landscape is flat and very quiet.)
  - why: The gloss 'of' is meaningless; the adjective means 'of Drenthe', and the example used the noun (the language) rather than the adjective.
- **eenzaadlobbig** (adjective) “of” — bad-gloss
  - gloss → “monocotyledonous”
  - why: The gloss "of" is meaningless; eenzaadlobbig is the botanical adjective for monocotyledonous (having one seed leaf).
- **energieslurper** (noun) “something” — bad-gloss
  - gloss → “energy guzzler”
  - example: ~~none~~ → Die oude koelkast is een echte energieslurper. (That old fridge is a real energy guzzler.)
  - why: The gloss "something" is too vague; "energy guzzler" captures the meaning, and an example is added.
- **energievreter** (noun) “something” — bad-gloss
  - gloss → “energy guzzler”
  - example: ~~none~~ → Die oude koelkast is een echte energievreter. (That old fridge is a real energy guzzler.)
  - why: The gloss 'something' is meaningless; 'energy guzzler' is the correct translation, and an example is added.
- **exponent** (noun) “someone” — bad-gloss
  - gloss → “representative (of a trend)”
  - example: ~~none~~ → Hij is een exponent van de moderne popcultuur. (He is an exponent of modern pop culture.)
  - why: The gloss "someone" is too vague; this meaning is a typical representative of a movement, distinct from the mathematical exponent, and it needs an example.
- **Faeröers** (adjective) “in” — bad-gloss
  - gloss → “Faroese”
  - why: The gloss "in" is wrong for this adjective; the correct English translation is "Faroese" (the other listed meaning is presumably the language noun, so adjective gloss should be Faroese too).
- **filmisch** (adjective) “of” — bad-gloss
  - gloss → “cinematic”
  - example: ~~none~~ → De regisseur maakte prachtige, filmische beelden van het landschap. (The director made beautiful, cinematic shots of the landscape.)
  - why: The gloss 'of' is meaningless; 'filmisch' means cinematic, and an example is added since none existed.
- **Gelders** (adjective) “Of” — bad-gloss
  - rejected: example: second model disagreed
- **geschiedfilosofisch** (adjective) “of” — bad-gloss
  - gloss → “of philosophy of history”
  - example: ~~none~~ → Het boek geeft een geschiedfilosofisch overzicht van de moderne tijd. (The book gives an overview of the modern era from the philosophy-of-history perspective.)
  - why: The gloss 'of' is meaningless; the adjective means relating to the philosophy of history, and no example existed.
- **Gouds** (adjective) “of” — bad-gloss
  - gloss → “of Gouda”
  - example: ~~none~~ → Ik heb een Goudse kaas gekocht op de markt. (I bought a Gouda cheese at the market.)
  - why: The gloss "of" is meaningless; Gouds means 'of or from Gouda', so a proper gloss and an example are needed.
- **Groenlands** (adjective) “in” — bad-gloss
  - rejected: example: second model disagreed
- **Groninger** (adjective) “of” — bad-gloss
  - rejected: example: second model disagreed
- **Gronings** (adjective) “of” — bad-gloss
  - gloss → “of Groningen”
  - example: ~~none~~ → Dit is een typisch Gronings gerecht. (This is a typical Groningen dish.)
  - why: The gloss 'of' is meaningless; the adjective means 'of or from Groningen', and a clearer gloss and an example are needed.
- **Haarlemmer** (adjective) “of” — bad-gloss
  - rejected: example: too short
- **Haarlems** (adjective) “of” — bad-gloss
  - rejected: example: second model disagreed
- **hoofdstedelijk** (adjective) “of” — bad-gloss
  - gloss → “of the capital”
  - why: The gloss "of" is incomplete and meaningless on its own; "of the capital" correctly renders hoofdstedelijk, and the existing example works fine.
