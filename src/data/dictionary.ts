import type { DictionaryEntry } from "../lib/types";
import { GENERATED } from "./freedict.generated";

/**
 * Woordkast bundled dictionary — Dutch → English, with grammatical gender and a
 * natural example sentence per word. Authored for the app (no runtime AI, fully
 * offline). Curated from common everyday vocabulary; easy to extend — just add
 * entries to the array below. `id` is the lower-cased Dutch headword.
 *
 * gender: "de" | "het" for nouns, null for verbs/adjectives/other.
 */
const ENTRIES: Omit<DictionaryEntry, "id">[] = [
  // — Greetings & social —
  { dutch: "hallo", english: "hello", gender: null, example: "Hallo, hoe gaat het met je?", exampleEn: "Hello, how are you?" },
  { dutch: "dankjewel", english: "thank you", gender: null, example: "Dankjewel voor je hulp.", exampleEn: "Thank you for your help." },
  { dutch: "alsjeblieft", english: "please / here you go", gender: null, example: "Mag ik de zout, alsjeblieft?", exampleEn: "May I have the salt, please?" },
  { dutch: "sorry", english: "sorry", gender: null, example: "Sorry, ik ben te laat.", exampleEn: "Sorry, I'm late." },
  { dutch: "goedemorgen", english: "good morning", gender: null, example: "Goedemorgen, heb je goed geslapen?", exampleEn: "Good morning, did you sleep well?" },
  { dutch: "welkom", english: "welcome", gender: null, example: "Welkom in ons huis.", exampleEn: "Welcome to our house." },

  // — People & family —
  { dutch: "vriend", english: "friend", gender: "de", example: "Mijn vriend woont in Rotterdam.", exampleEn: "My friend lives in Rotterdam." },
  { dutch: "vrouw", english: "woman / wife", gender: "de", example: "De vrouw leest een boek in de tuin.", exampleEn: "The woman reads a book in the garden." },
  { dutch: "man", english: "man / husband", gender: "de", example: "De man wacht op de bus.", exampleEn: "The man is waiting for the bus." },
  { dutch: "kind", english: "child", gender: "het", example: "Het kind speelt op straat.", exampleEn: "The child plays in the street." },
  { dutch: "moeder", english: "mother", gender: "de", example: "Mijn moeder kookt elke avond.", exampleEn: "My mother cooks every evening." },
  { dutch: "vader", english: "father", gender: "de", example: "Zijn vader werkt in Amsterdam.", exampleEn: "His father works in Amsterdam." },
  { dutch: "buurman", english: "neighbour", gender: "de", example: "De buurman groet altijd vriendelijk.", exampleEn: "The neighbour always greets you kindly." },
  { dutch: "collega", english: "colleague", gender: "de", example: "Mijn collega is vandaag ziek.", exampleEn: "My colleague is sick today." },
  { dutch: "mens", english: "human / person", gender: "de", example: "Ieder mens maakt fouten.", exampleEn: "Every human makes mistakes." },
  { dutch: "naam", english: "name", gender: "de", example: "Wat is jouw naam?", exampleEn: "What is your name?" },

  // — Home & objects —
  { dutch: "huis", english: "house", gender: "het", example: "Hun huis staat aan een gracht.", exampleEn: "Their house is on a canal." },
  { dutch: "deur", english: "door", gender: "de", example: "Doe de deur even dicht.", exampleEn: "Close the door, please." },
  { dutch: "raam", english: "window", gender: "het", example: "Het raam staat open.", exampleEn: "The window is open." },
  { dutch: "tafel", english: "table", gender: "de", example: "Het eten staat op tafel.", exampleEn: "The food is on the table." },
  { dutch: "stoel", english: "chair", gender: "de", example: "Ga op die stoel zitten.", exampleEn: "Sit down on that chair." },
  { dutch: "bed", english: "bed", gender: "het", example: "Ik ga vroeg naar bed.", exampleEn: "I'm going to bed early." },
  { dutch: "sleutel", english: "key", gender: "de", example: "Ik ben mijn sleutel kwijt.", exampleEn: "I lost my key." },
  { dutch: "boek", english: "book", gender: "het", example: "Zij leest elke avond een boek.", exampleEn: "She reads a book every evening." },
  { dutch: "telefoon", english: "phone", gender: "de", example: "Mijn telefoon is bijna leeg.", exampleEn: "My phone is almost out of battery." },
  { dutch: "geld", english: "money", gender: "het", example: "Ik heb niet genoeg geld bij me.", exampleEn: "I don't have enough money on me." },
  { dutch: "tas", english: "bag", gender: "de", example: "Ze draagt een zware tas.", exampleEn: "She is carrying a heavy bag." },
  { dutch: "kast", english: "cupboard / cabinet", gender: "de", example: "De borden staan in de kast.", exampleEn: "The plates are in the cupboard." },

  // — Food & drink —
  { dutch: "brood", english: "bread", gender: "het", example: "We kopen elke ochtend vers brood.", exampleEn: "We buy fresh bread every morning." },
  { dutch: "kaas", english: "cheese", gender: "de", example: "Op de markt verkopen ze oude kaas.", exampleEn: "At the market they sell aged cheese." },
  { dutch: "water", english: "water", gender: "het", example: "Wil je een glas water?", exampleEn: "Would you like a glass of water?" },
  { dutch: "koffie", english: "coffee", gender: "de", example: "Zullen we ergens koffie drinken?", exampleEn: "Shall we go drink coffee somewhere?" },
  { dutch: "melk", english: "milk", gender: "de", example: "Doe je melk in je thee?", exampleEn: "Do you put milk in your tea?" },
  { dutch: "appel", english: "apple", gender: "de", example: "Hij eet elke dag een appel.", exampleEn: "He eats an apple every day." },
  { dutch: "ei", english: "egg", gender: "het", example: "Ik wil graag een gekookt ei.", exampleEn: "I'd like a boiled egg." },
  { dutch: "eten", english: "food / to eat", gender: "het", example: "Het eten is bijna klaar.", exampleEn: "The food is almost ready." },
  { dutch: "vlees", english: "meat", gender: "het", example: "Zij eet geen vlees.", exampleEn: "She doesn't eat meat." },
  { dutch: "groente", english: "vegetable", gender: "de", example: "Eet je groente op!", exampleEn: "Eat your vegetables!" },
  { dutch: "bier", english: "beer", gender: "het", example: "Een biertje op het terras is heerlijk.", exampleEn: "A beer on the terrace is lovely." },
  { dutch: "soep", english: "soup", gender: "de", example: "De soep is nog te heet.", exampleEn: "The soup is still too hot." },

  // — City, travel & transport —
  { dutch: "stad", english: "city", gender: "de", example: "Delft is een mooie oude stad.", exampleEn: "Delft is a beautiful old city." },
  { dutch: "straat", english: "street", gender: "de", example: "De kinderen spelen op straat.", exampleEn: "The children play in the street." },
  { dutch: "fiets", english: "bicycle", gender: "de", example: "Ik ga met de fiets naar mijn werk.", exampleEn: "I go to work by bike." },
  { dutch: "trein", english: "train", gender: "de", example: "De trein naar Utrecht vertrekt zo.", exampleEn: "The train to Utrecht is about to leave." },
  { dutch: "auto", english: "car", gender: "de", example: "Onze auto staat voor de deur.", exampleEn: "Our car is parked out front." },
  { dutch: "weg", english: "road / way", gender: "de", example: "De weg is afgesloten.", exampleEn: "The road is closed." },
  { dutch: "station", english: "station", gender: "het", example: "Het station ligt in het centrum.", exampleEn: "The station is in the centre." },
  { dutch: "winkel", english: "shop", gender: "de", example: "De winkel sluit om zes uur.", exampleEn: "The shop closes at six o'clock." },
  { dutch: "markt", english: "market", gender: "de", example: "Op zaterdag is er markt.", exampleEn: "There is a market on Saturday." },
  { dutch: "kaart", english: "ticket / map / card", gender: "de", example: "Heb je een kaart voor het concert?", exampleEn: "Do you have a ticket for the concert?" },
  { dutch: "brug", english: "bridge", gender: "de", example: "Loop over de brug naar het museum.", exampleEn: "Walk over the bridge to the museum." },
  { dutch: "gracht", english: "canal", gender: "de", example: "De gracht is bevroren in de winter.", exampleEn: "The canal is frozen in winter." },

  // — Time & calendar —
  { dutch: "tijd", english: "time", gender: "de", example: "Ik heb geen tijd vandaag.", exampleEn: "I don't have time today." },
  { dutch: "dag", english: "day", gender: "de", example: "Fijne dag nog!", exampleEn: "Have a nice day!" },
  { dutch: "week", english: "week", gender: "de", example: "Volgende week ben ik vrij.", exampleEn: "I'm off next week." },
  { dutch: "jaar", english: "year", gender: "het", example: "Zij woont hier al een jaar.", exampleEn: "She has lived here for a year now." },
  { dutch: "uur", english: "hour", gender: "het", example: "De film duurt twee uur.", exampleEn: "The film lasts two hours." },
  { dutch: "morgen", english: "tomorrow / morning", gender: null, example: "Morgen ga ik naar de dokter.", exampleEn: "Tomorrow I'm going to the doctor." },
  { dutch: "vandaag", english: "today", gender: null, example: "Vandaag is het mooi weer.", exampleEn: "The weather is nice today." },
  { dutch: "gisteren", english: "yesterday", gender: null, example: "Gisteren regende het de hele dag.", exampleEn: "It rained all day yesterday." },
  { dutch: "avond", english: "evening", gender: "de", example: "We eten 's avonds om zeven uur.", exampleEn: "We eat at seven in the evening." },
  { dutch: "nacht", english: "night", gender: "de", example: "Het was een koude nacht.", exampleEn: "It was a cold night." },

  // — Nature & weather —
  { dutch: "weer", english: "weather", gender: "het", example: "Het weer is vandaag wisselvallig.", exampleEn: "The weather is changeable today." },
  { dutch: "regen", english: "rain", gender: "de", example: "Door de regen bleven we binnen.", exampleEn: "Because of the rain we stayed inside." },
  { dutch: "zon", english: "sun", gender: "de", example: "De zon schijnt eindelijk.", exampleEn: "The sun is finally shining." },
  { dutch: "wind", english: "wind", gender: "de", example: "Er staat een harde wind.", exampleEn: "There's a strong wind." },
  { dutch: "sneeuw", english: "snow", gender: "de", example: "De kinderen spelen in de sneeuw.", exampleEn: "The children play in the snow." },
  { dutch: "boom", english: "tree", gender: "de", example: "In de tuin staat een grote boom.", exampleEn: "There's a big tree in the garden." },
  { dutch: "bloem", english: "flower", gender: "de", example: "Ik koop een bos bloemen voor haar.", exampleEn: "I'm buying a bunch of flowers for her." },
  { dutch: "hond", english: "dog", gender: "de", example: "De hond rent door het park.", exampleEn: "The dog runs through the park." },
  { dutch: "kat", english: "cat", gender: "de", example: "De kat slaapt op de bank.", exampleEn: "The cat sleeps on the couch." },
  { dutch: "vogel", english: "bird", gender: "de", example: "Een vogel zingt in de boom.", exampleEn: "A bird sings in the tree." },
  { dutch: "water", english: "water", gender: "het", example: "Het water in de gracht is koud.", exampleEn: "The water in the canal is cold." },
  { dutch: "lucht", english: "sky / air", gender: "de", example: "De lucht is helderblauw.", exampleEn: "The sky is bright blue." },

  // — Body & health —
  { dutch: "hand", english: "hand", gender: "de", example: "Geef me een hand.", exampleEn: "Give me your hand." },
  { dutch: "hoofd", english: "head", gender: "het", example: "Ik heb pijn in mijn hoofd.", exampleEn: "I have a pain in my head." },
  { dutch: "oog", english: "eye", gender: "het", example: "Er zit iets in mijn oog.", exampleEn: "There's something in my eye." },
  { dutch: "voet", english: "foot", gender: "de", example: "Mijn voet doet zeer.", exampleEn: "My foot hurts." },
  { dutch: "dokter", english: "doctor", gender: "de", example: "Ik heb morgen een afspraak bij de dokter.", exampleEn: "I have a doctor's appointment tomorrow." },
  { dutch: "ziekenhuis", english: "hospital", gender: "het", example: "Het ziekenhuis is dichtbij.", exampleEn: "The hospital is nearby." },
  { dutch: "pijn", english: "pain", gender: "de", example: "Heb je nog steeds pijn?", exampleEn: "Are you still in pain?" },

  // — School, work & abstract —
  { dutch: "werk", english: "work", gender: "het", example: "Na het werk ga ik sporten.", exampleEn: "After work I go to the gym." },
  { dutch: "school", english: "school", gender: "de", example: "De school begint om half negen.", exampleEn: "School starts at half past eight." },
  { dutch: "woord", english: "word", gender: "het", example: "Ik ken dit woord nog niet.", exampleEn: "I don't know this word yet." },
  { dutch: "taal", english: "language", gender: "de", example: "Nederlands is een mooie taal.", exampleEn: "Dutch is a beautiful language." },
  { dutch: "vraag", english: "question", gender: "de", example: "Ik heb nog een vraag.", exampleEn: "I have one more question." },
  { dutch: "antwoord", english: "answer", gender: "het", example: "Het antwoord is heel simpel.", exampleEn: "The answer is very simple." },
  { dutch: "geld", english: "money", gender: "het", example: "Sparen kost tijd en geld.", exampleEn: "Saving takes time and money." },
  { dutch: "brief", english: "letter", gender: "de", example: "Er ligt een brief op de mat.", exampleEn: "There's a letter on the doormat." },
  { dutch: "artikel", english: "article", gender: "het", example: "Ik heb een interessant artikel gelezen.", exampleEn: "I read an interesting article." },
  { dutch: "afspraak", english: "appointment / agreement", gender: "de", example: "We hebben een afspraak om drie uur.", exampleEn: "We have an appointment at three." },
  { dutch: "gewoonte", english: "habit", gender: "de", example: "Het is een goede gewoonte om te lezen.", exampleEn: "It's a good habit to read." },
  { dutch: "aandacht", english: "attention", gender: "de", example: "Hij vraagt de hele dag om aandacht.", exampleEn: "He asks for attention all day." },
  { dutch: "vertaling", english: "translation", gender: "de", example: "De vertaling was niet makkelijk.", exampleEn: "The translation was not easy." },
  { dutch: "tentoonstelling", english: "exhibition", gender: "de", example: "De tentoonstelling trok veel bezoekers.", exampleEn: "The exhibition drew many visitors." },
  { dutch: "schilderij", english: "painting", gender: "het", example: "Het schilderij hangt in het museum.", exampleEn: "The painting hangs in the museum." },

  // — Common verbs (infinitive) —
  { dutch: "zijn", english: "to be", gender: null, example: "Ik wil graag thuis zijn.", exampleEn: "I'd like to be home." },
  { dutch: "hebben", english: "to have", gender: null, example: "We hebben geen brood meer.", exampleEn: "We don't have any bread left." },
  { dutch: "doen", english: "to do", gender: null, example: "Wat ga je dit weekend doen?", exampleEn: "What are you going to do this weekend?" },
  { dutch: "gaan", english: "to go", gender: null, example: "Ik ga nu naar huis.", exampleEn: "I'm going home now." },
  { dutch: "komen", english: "to come", gender: null, example: "Kom je vanavond ook?", exampleEn: "Are you coming tonight too?" },
  { dutch: "zien", english: "to see", gender: null, example: "Ik kan het bord niet goed zien.", exampleEn: "I can't see the sign clearly." },
  { dutch: "weten", english: "to know", gender: null, example: "Ik weet het antwoord niet.", exampleEn: "I don't know the answer." },
  { dutch: "kennen", english: "to know (be familiar with)", gender: null, example: "Ik ken hem al jaren.", exampleEn: "I've known him for years." },
  { dutch: "zeggen", english: "to say", gender: null, example: "Wat wil je daarmee zeggen?", exampleEn: "What do you mean by that?" },
  { dutch: "denken", english: "to think", gender: null, example: "Ik denk dat het gaat regenen.", exampleEn: "I think it's going to rain." },
  { dutch: "praten", english: "to talk", gender: null, example: "We praten morgen verder.", exampleEn: "We'll talk more tomorrow." },
  { dutch: "lezen", english: "to read", gender: null, example: "Hij leert Nederlands door te lezen.", exampleEn: "He's learning Dutch by reading." },
  { dutch: "schrijven", english: "to write", gender: null, example: "Ik moet nog een brief schrijven.", exampleEn: "I still have to write a letter." },
  { dutch: "werken", english: "to work", gender: null, example: "Zij werkt bij een grote bank.", exampleEn: "She works at a big bank." },
  { dutch: "wonen", english: "to live (reside)", gender: null, example: "Wij wonen in het centrum.", exampleEn: "We live in the centre." },
  { dutch: "eten", english: "to eat", gender: null, example: "We gaan om zes uur eten.", exampleEn: "We're going to eat at six." },
  { dutch: "drinken", english: "to drink", gender: null, example: "Wil je iets drinken?", exampleEn: "Would you like something to drink?" },
  { dutch: "kopen", english: "to buy", gender: null, example: "Ik ga kaas kopen op de markt.", exampleEn: "I'm going to buy cheese at the market." },
  { dutch: "lopen", english: "to walk", gender: null, example: "We lopen langs de gracht.", exampleEn: "We walk along the canal." },
  { dutch: "rijden", english: "to drive / ride", gender: null, example: "Hij rijdt elke dag naar zijn werk.", exampleEn: "He drives to work every day." },
  { dutch: "slapen", english: "to sleep", gender: null, example: "De baby slaapt nu eindelijk.", exampleEn: "The baby is finally sleeping." },
  { dutch: "helpen", english: "to help", gender: null, example: "Kun je me even helpen?", exampleEn: "Can you help me for a moment?" },
  { dutch: "geven", english: "to give", gender: null, example: "Geef mij het zout, alsjeblieft.", exampleEn: "Pass me the salt, please." },
  { dutch: "nemen", english: "to take", gender: null, example: "Ik neem de trein van negen uur.", exampleEn: "I'll take the nine o'clock train." },
  { dutch: "leren", english: "to learn / teach", gender: null, example: "Ik wil Nederlands leren.", exampleEn: "I want to learn Dutch." },
  { dutch: "spreken", english: "to speak", gender: null, example: "Spreek je een beetje Nederlands?", exampleEn: "Do you speak a little Dutch?" },
  { dutch: "begrijpen", english: "to understand", gender: null, example: "Ik begrijp de vraag niet.", exampleEn: "I don't understand the question." },
  { dutch: "wachten", english: "to wait", gender: null, example: "We wachten op de bus.", exampleEn: "We're waiting for the bus." },
  { dutch: "betalen", english: "to pay", gender: null, example: "Kan ik met pin betalen?", exampleEn: "Can I pay by card?" },
  { dutch: "vinden", english: "to find / think", gender: null, example: "Ik vind dit een leuk idee.", exampleEn: "I think this is a nice idea." },

  // — Common adjectives & adverbs —
  { dutch: "groot", english: "big / large", gender: null, example: "Amsterdam is een grote stad.", exampleEn: "Amsterdam is a big city." },
  { dutch: "klein", english: "small", gender: null, example: "Ze wonen in een klein huis.", exampleEn: "They live in a small house." },
  { dutch: "mooi", english: "beautiful / nice", gender: null, example: "Wat een mooi schilderij!", exampleEn: "What a beautiful painting!" },
  { dutch: "goed", english: "good", gender: null, example: "Het gaat goed met me.", exampleEn: "I'm doing well." },
  { dutch: "slecht", english: "bad", gender: null, example: "Het weer is vandaag slecht.", exampleEn: "The weather is bad today." },
  { dutch: "nieuw", english: "new", gender: null, example: "Ze heeft een nieuwe fiets.", exampleEn: "She has a new bike." },
  { dutch: "oud", english: "old", gender: null, example: "Dit is een oud gebouw.", exampleEn: "This is an old building." },
  { dutch: "duur", english: "expensive", gender: null, example: "De kaart was best duur.", exampleEn: "The ticket was quite expensive." },
  { dutch: "goedkoop", english: "cheap", gender: null, example: "Op de markt is het goedkoop.", exampleEn: "Things are cheap at the market." },
  { dutch: "warm", english: "warm", gender: null, example: "Het is warm in de kamer.", exampleEn: "It's warm in the room." },
  { dutch: "koud", english: "cold", gender: null, example: "Mijn handen zijn koud.", exampleEn: "My hands are cold." },
  { dutch: "snel", english: "fast / quick", gender: null, example: "De trein is heel snel.", exampleEn: "The train is very fast." },
  { dutch: "langzaam", english: "slow", gender: null, example: "Hij praat heel langzaam.", exampleEn: "He speaks very slowly." },
  { dutch: "moeilijk", english: "difficult", gender: null, example: "Nederlands is soms moeilijk.", exampleEn: "Dutch is sometimes difficult." },
  { dutch: "makkelijk", english: "easy", gender: null, example: "Dit woord is makkelijk.", exampleEn: "This word is easy." },
  { dutch: "leuk", english: "fun / nice", gender: null, example: "Dat was een leuk feest.", exampleEn: "That was a fun party." },
  { dutch: "moe", english: "tired", gender: null, example: "Ik ben vandaag erg moe.", exampleEn: "I'm very tired today." },
  { dutch: "blij", english: "happy / glad", gender: null, example: "Ik ben blij je te zien.", exampleEn: "I'm glad to see you." },
  { dutch: "vol", english: "full", gender: null, example: "De trein zit helemaal vol.", exampleEn: "The train is completely full." },
  { dutch: "samen", english: "together", gender: null, example: "We doen het samen.", exampleEn: "We'll do it together." },

  // — Useful nouns & extras —
  { dutch: "ding", english: "thing", gender: "het", example: "Er is nog één ding dat ik wil zeggen.", exampleEn: "There's one more thing I want to say." },
  { dutch: "idee", english: "idea", gender: "het", example: "Dat is een goed idee.", exampleEn: "That's a good idea." },
  { dutch: "probleem", english: "problem", gender: "het", example: "Geen probleem, ik help je.", exampleEn: "No problem, I'll help you." },
  { dutch: "feest", english: "party", gender: "het", example: "Zaterdag is er een groot feest.", exampleEn: "There's a big party on Saturday." },
  { dutch: "muziek", english: "music", gender: "de", example: "Zij houdt van klassieke muziek.", exampleEn: "She loves classical music." },
  { dutch: "film", english: "film / movie", gender: "de", example: "We kijken vanavond een film.", exampleEn: "We're watching a film tonight." },
  { dutch: "verhaal", english: "story", gender: "het", example: "Vertel me het hele verhaal.", exampleEn: "Tell me the whole story." },
  { dutch: "geluk", english: "luck / happiness", gender: "het", example: "Veel geluk met je examen!", exampleEn: "Good luck with your exam!" },
  { dutch: "kans", english: "chance / opportunity", gender: "de", example: "Dit is een mooie kans.", exampleEn: "This is a great opportunity." },
  { dutch: "reis", english: "trip / journey", gender: "de", example: "Goede reis!", exampleEn: "Have a good trip!" },
  { dutch: "wereld", english: "world", gender: "de", example: "Hij heeft de hele wereld gezien.", exampleEn: "He has seen the whole world." },
  { dutch: "land", english: "country", gender: "het", example: "Nederland is een klein land.", exampleEn: "The Netherlands is a small country." },
  { dutch: "leven", english: "life", gender: "het", example: "Het leven hier is rustig.", exampleEn: "Life here is calm." },
  { dutch: "werk", english: "work / job", gender: "het", example: "Zij zoekt nieuw werk.", exampleEn: "She's looking for a new job." },
  { dutch: "geluid", english: "sound / noise", gender: "het", example: "Wat is dat voor geluid?", exampleEn: "What's that noise?" },
  { dutch: "kleur", english: "colour", gender: "de", example: "Blauw is mijn favoriete kleur.", exampleEn: "Blue is my favourite colour." },

  // ── Batch 1: common words expansion ──
  // Places in town
  { dutch: "kerk", english: "church", gender: "de", example: "De kerk staat midden in het dorp.", exampleEn: "The church is in the middle of the village." },
  { dutch: "museum", english: "museum", gender: "het", example: "Het museum is op maandag gesloten.", exampleEn: "The museum is closed on Mondays." },
  { dutch: "restaurant", english: "restaurant", gender: "het", example: "We eten vanavond in een restaurant.", exampleEn: "We're eating at a restaurant tonight." },
  { dutch: "hotel", english: "hotel", gender: "het", example: "Het hotel ligt vlak bij het strand.", exampleEn: "The hotel is right by the beach." },
  { dutch: "bibliotheek", english: "library", gender: "de", example: "Ik leen boeken bij de bibliotheek.", exampleEn: "I borrow books from the library." },
  { dutch: "supermarkt", english: "supermarket", gender: "de", example: "De supermarkt is tot tien uur open.", exampleEn: "The supermarket is open until ten." },
  { dutch: "apotheek", english: "pharmacy", gender: "de", example: "Je haalt de medicijnen bij de apotheek.", exampleEn: "You collect the medicine from the pharmacy." },
  { dutch: "bank", english: "bank", gender: "de", example: "Ik moet even naar de bank.", exampleEn: "I need to pop to the bank." },
  { dutch: "park", english: "park", gender: "het", example: "We wandelen graag in het park.", exampleEn: "We like to walk in the park." },
  { dutch: "plein", english: "square", gender: "het", example: "Op het plein staat een standbeeld.", exampleEn: "There's a statue on the square." },
  { dutch: "strand", english: "beach", gender: "het", example: "In de zomer gaan we naar het strand.", exampleEn: "In summer we go to the beach." },
  { dutch: "zee", english: "sea", gender: "de", example: "De zee is vandaag heel rustig.", exampleEn: "The sea is very calm today." },
  { dutch: "bos", english: "forest / wood", gender: "het", example: "We fietsen door het bos.", exampleEn: "We cycle through the forest." },
  { dutch: "berg", english: "mountain", gender: "de", example: "Vanaf de berg zie je het hele dal.", exampleEn: "From the mountain you can see the whole valley." },
  { dutch: "dorp", english: "village", gender: "het", example: "Zij is in een klein dorp opgegroeid.", exampleEn: "She grew up in a small village." },

  // House & rooms
  { dutch: "kamer", english: "room", gender: "de", example: "Mijn kamer kijkt uit op de tuin.", exampleEn: "My room looks out onto the garden." },
  { dutch: "keuken", english: "kitchen", gender: "de", example: "De keuken ruikt naar verse koffie.", exampleEn: "The kitchen smells of fresh coffee." },
  { dutch: "badkamer", english: "bathroom", gender: "de", example: "De badkamer is net schoongemaakt.", exampleEn: "The bathroom has just been cleaned." },
  { dutch: "slaapkamer", english: "bedroom", gender: "de", example: "De kinderen delen een slaapkamer.", exampleEn: "The children share a bedroom." },
  { dutch: "tuin", english: "garden", gender: "de", example: "In de tuin bloeien de rozen.", exampleEn: "The roses are blooming in the garden." },
  { dutch: "muur", english: "wall", gender: "de", example: "Aan de muur hangt een klok.", exampleEn: "There's a clock on the wall." },
  { dutch: "vloer", english: "floor", gender: "de", example: "De vloer is koud onder je voeten.", exampleEn: "The floor is cold under your feet." },
  { dutch: "trap", english: "stairs", gender: "de", example: "Neem de trap, niet de lift.", exampleEn: "Take the stairs, not the lift." },
  { dutch: "lamp", english: "lamp", gender: "de", example: "Doe je de lamp even aan?", exampleEn: "Could you turn the lamp on?" },
  { dutch: "bank", english: "couch / bank", gender: "de", example: "Hij ligt op de bank te slapen.", exampleEn: "He's asleep on the couch." },
  { dutch: "spiegel", english: "mirror", gender: "de", example: "Ze kijkt in de spiegel.", exampleEn: "She looks in the mirror." },

  // Kitchen & table
  { dutch: "bord", english: "plate", gender: "het", example: "Zet de borden op tafel.", exampleEn: "Put the plates on the table." },
  { dutch: "glas", english: "glass", gender: "het", example: "Mag ik nog een glas water?", exampleEn: "May I have another glass of water?" },
  { dutch: "vork", english: "fork", gender: "de", example: "Er ligt geen vork bij mijn bord.", exampleEn: "There's no fork by my plate." },
  { dutch: "mes", english: "knife", gender: "het", example: "Dit mes is niet scherp genoeg.", exampleEn: "This knife isn't sharp enough." },
  { dutch: "lepel", english: "spoon", gender: "de", example: "Roer met een lepel door de soep.", exampleEn: "Stir the soup with a spoon." },
  { dutch: "pan", english: "pan", gender: "de", example: "De pan staat op het vuur.", exampleEn: "The pan is on the stove." },
  { dutch: "koelkast", english: "fridge", gender: "de", example: "De melk staat in de koelkast.", exampleEn: "The milk is in the fridge." },

  // Clothing
  { dutch: "jas", english: "coat", gender: "de", example: "Doe je jas aan, het is koud.", exampleEn: "Put your coat on, it's cold." },
  { dutch: "broek", english: "trousers", gender: "de", example: "Deze broek is me te groot.", exampleEn: "These trousers are too big for me." },
  { dutch: "overhemd", english: "shirt", gender: "het", example: "Hij draagt een wit overhemd.", exampleEn: "He's wearing a white shirt." },
  { dutch: "schoen", english: "shoe", gender: "de", example: "Mijn linker schoen zit te strak.", exampleEn: "My left shoe is too tight." },
  { dutch: "jurk", english: "dress", gender: "de", example: "Ze draagt een mooie blauwe jurk.", exampleEn: "She's wearing a lovely blue dress." },
  { dutch: "trui", english: "sweater", gender: "de", example: "Trek een warme trui aan.", exampleEn: "Put on a warm sweater." },
  { dutch: "bril", english: "glasses", gender: "de", example: "Zonder bril zie ik niets.", exampleEn: "Without glasses I can't see a thing." },

  // Office & tech
  { dutch: "computer", english: "computer", gender: "de", example: "Mijn computer is weer traag.", exampleEn: "My computer is slow again." },
  { dutch: "scherm", english: "screen", gender: "het", example: "Het scherm is te fel.", exampleEn: "The screen is too bright." },
  { dutch: "internet", english: "internet", gender: "het", example: "Het internet doet het niet.", exampleEn: "The internet isn't working." },
  { dutch: "bestand", english: "file", gender: "het", example: "Ik kan het bestand niet openen.", exampleEn: "I can't open the file." },
  { dutch: "bureau", english: "desk", gender: "het", example: "Mijn papieren liggen op het bureau.", exampleEn: "My papers are on the desk." },
  { dutch: "vergadering", english: "meeting", gender: "de", example: "De vergadering duurt te lang.", exampleEn: "The meeting is taking too long." },
  { dutch: "baas", english: "boss", gender: "de", example: "Mijn baas is vandaag in een goede bui.", exampleEn: "My boss is in a good mood today." },

  // Money & shopping
  { dutch: "prijs", english: "price", gender: "de", example: "De prijs is de afgelopen maand gestegen.", exampleEn: "The price has gone up over the past month." },
  { dutch: "korting", english: "discount", gender: "de", example: "Er is korting op alle jassen.", exampleEn: "There's a discount on all coats." },
  { dutch: "rekening", english: "bill / account", gender: "de", example: "Mag ik de rekening, alstublieft?", exampleEn: "Could I have the bill, please?" },
  { dutch: "portemonnee", english: "wallet", gender: "de", example: "Ik ben mijn portemonnee vergeten.", exampleEn: "I've forgotten my wallet." },
  { dutch: "kassa", english: "checkout / till", gender: "de", example: "Er staat een lange rij bij de kassa.", exampleEn: "There's a long queue at the checkout." },

  // States & feelings
  { dutch: "honger", english: "hunger", gender: "de", example: "Ik heb enorme honger.", exampleEn: "I'm really hungry." },
  { dutch: "dorst", english: "thirst", gender: "de", example: "Na het sporten heb ik dorst.", exampleEn: "After exercising I'm thirsty." },
  { dutch: "bang", english: "afraid", gender: null, example: "Het kind is bang voor de hond.", exampleEn: "The child is afraid of the dog." },
  { dutch: "boos", english: "angry", gender: null, example: "Ze is boos op haar broer.", exampleEn: "She's angry with her brother." },
  { dutch: "ziek", english: "sick / ill", gender: null, example: "Hij is ziek en blijft thuis.", exampleEn: "He's ill and staying home." },
  { dutch: "druk", english: "busy", gender: null, example: "Het is druk in de winkel.", exampleEn: "The shop is busy." },

  // More common verbs
  { dutch: "koken", english: "to cook", gender: null, example: "Vanavond kook ik pasta.", exampleEn: "Tonight I'll cook pasta." },
  { dutch: "wassen", english: "to wash", gender: null, example: "Ik moet mijn kleren nog wassen.", exampleEn: "I still have to wash my clothes." },
  { dutch: "schoonmaken", english: "to clean", gender: null, example: "Op zaterdag maken we het huis schoon.", exampleEn: "On Saturdays we clean the house." },
  { dutch: "gebruiken", english: "to use", gender: null, example: "Mag ik je pen even gebruiken?", exampleEn: "May I use your pen for a second?" },
  { dutch: "beginnen", english: "to begin", gender: null, example: "De les begint over vijf minuten.", exampleEn: "The lesson begins in five minutes." },
  { dutch: "sluiten", english: "to close", gender: null, example: "De winkels sluiten om zes uur.", exampleEn: "The shops close at six." },
  { dutch: "openen", english: "to open", gender: null, example: "Ze openen morgen een nieuw filiaal.", exampleEn: "They're opening a new branch tomorrow." },
  { dutch: "vragen", english: "to ask", gender: null, example: "Mag ik je iets vragen?", exampleEn: "May I ask you something?" },
  { dutch: "bellen", english: "to call (phone)", gender: null, example: "Ik bel je vanavond terug.", exampleEn: "I'll call you back tonight." },
  { dutch: "sturen", english: "to send", gender: null, example: "Ik stuur je het adres per bericht.", exampleEn: "I'll send you the address by message." },
  { dutch: "brengen", english: "to bring", gender: null, example: "Kun je het pakket naar haar brengen?", exampleEn: "Can you bring the parcel to her?" },
  { dutch: "zoeken", english: "to search / look for", gender: null, example: "Ik zoek mijn sleutels.", exampleEn: "I'm looking for my keys." },
  { dutch: "verliezen", english: "to lose", gender: null, example: "Ik wil dit spel niet verliezen.", exampleEn: "I don't want to lose this game." },
  { dutch: "winnen", english: "to win", gender: null, example: "Welk team gaat winnen?", exampleEn: "Which team is going to win?" },
  { dutch: "proberen", english: "to try", gender: null, example: "Probeer het nog een keer.", exampleEn: "Try it one more time." },
  { dutch: "kiezen", english: "to choose", gender: null, example: "Je mag zelf kiezen.", exampleEn: "You may choose yourself." },
  { dutch: "veranderen", english: "to change", gender: null, example: "Er is veel veranderd in de stad.", exampleEn: "A lot has changed in the city." },
  { dutch: "blijven", english: "to stay / remain", gender: null, example: "Blijf je vanavond thuis?", exampleEn: "Are you staying home tonight?" },
  { dutch: "worden", english: "to become", gender: null, example: "Het wordt morgen warmer.", exampleEn: "It'll get warmer tomorrow." },
  { dutch: "voelen", english: "to feel", gender: null, example: "Ik voel me vandaag veel beter.", exampleEn: "I feel much better today." },
  { dutch: "horen", english: "to hear", gender: null, example: "Hoor je dat geluid ook?", exampleEn: "Do you hear that sound too?" },
  { dutch: "kijken", english: "to look / watch", gender: null, example: "We kijken samen naar de wedstrijd.", exampleEn: "We're watching the match together." },
  { dutch: "luisteren", english: "to listen", gender: null, example: "Luister goed naar de vraag.", exampleEn: "Listen carefully to the question." },
  { dutch: "vergeten", english: "to forget", gender: null, example: "Vergeet je paraplu niet.", exampleEn: "Don't forget your umbrella." },
  { dutch: "onthouden", english: "to remember", gender: null, example: "Dit woord is moeilijk te onthouden.", exampleEn: "This word is hard to remember." },
  { dutch: "vertellen", english: "to tell", gender: null, example: "Vertel eens wat er gebeurd is.", exampleEn: "Tell me what happened." },
  { dutch: "spelen", english: "to play", gender: null, example: "De kinderen spelen in de tuin.", exampleEn: "The children are playing in the garden." },
  { dutch: "reizen", english: "to travel", gender: null, example: "Zij reist graag door Europa.", exampleEn: "She loves travelling through Europe." },
  { dutch: "zwemmen", english: "to swim", gender: null, example: "In de zomer gaan we vaak zwemmen.", exampleEn: "In summer we often go swimming." },
  { dutch: "zingen", english: "to sing", gender: null, example: "Hij zingt in een koor.", exampleEn: "He sings in a choir." },

  // More common adjectives
  { dutch: "lang", english: "long / tall", gender: null, example: "Het is een lange dag geweest.", exampleEn: "It's been a long day." },
  { dutch: "kort", english: "short", gender: null, example: "We nemen een korte pauze.", exampleEn: "We're taking a short break." },
  { dutch: "hoog", english: "high / tall", gender: null, example: "Die toren is erg hoog.", exampleEn: "That tower is very high." },
  { dutch: "laag", english: "low", gender: null, example: "De prijzen zijn nu laag.", exampleEn: "The prices are low right now." },
  { dutch: "breed", english: "wide", gender: null, example: "De rivier is hier heel breed.", exampleEn: "The river is very wide here." },
  { dutch: "zwaar", english: "heavy", gender: null, example: "Deze koffer is te zwaar.", exampleEn: "This suitcase is too heavy." },
  { dutch: "licht", english: "light", gender: null, example: "De tas is gelukkig licht.", exampleEn: "Luckily the bag is light." },
  { dutch: "sterk", english: "strong", gender: null, example: "Hij is sterk genoeg om te helpen.", exampleEn: "He's strong enough to help." },
  { dutch: "leeg", english: "empty", gender: null, example: "De fles is al leeg.", exampleEn: "The bottle is already empty." },
  { dutch: "schoon", english: "clean", gender: null, example: "Mijn handen zijn weer schoon.", exampleEn: "My hands are clean again." },
  { dutch: "vies", english: "dirty", gender: null, example: "Je schoenen zijn helemaal vies.", exampleEn: "Your shoes are completely dirty." },
  { dutch: "nat", english: "wet", gender: null, example: "Mijn jas is nat van de regen.", exampleEn: "My coat is wet from the rain." },
  { dutch: "droog", english: "dry", gender: null, example: "De handdoek is nog niet droog.", exampleEn: "The towel isn't dry yet." },
  { dutch: "donker", english: "dark", gender: null, example: "Het wordt vroeg donker in de winter.", exampleEn: "It gets dark early in winter." },
  { dutch: "stil", english: "quiet", gender: null, example: "Het is hier lekker stil.", exampleEn: "It's nice and quiet here." },
  { dutch: "vroeg", english: "early", gender: null, example: "Ik sta morgen vroeg op.", exampleEn: "I'm getting up early tomorrow." },
  { dutch: "laat", english: "late", gender: null, example: "Het is al laat, ik ga slapen.", exampleEn: "It's late already, I'm going to sleep." },
  { dutch: "ver", english: "far", gender: null, example: "Is het station nog ver?", exampleEn: "Is the station still far?" },
  { dutch: "aardig", english: "kind / nice", gender: null, example: "De buurvrouw is heel aardig.", exampleEn: "The neighbour is very kind." },
  { dutch: "grappig", english: "funny", gender: null, example: "Dat was een grappig verhaal.", exampleEn: "That was a funny story." },
  { dutch: "belangrijk", english: "important", gender: null, example: "Dit is een belangrijke vraag.", exampleEn: "This is an important question." },
  { dutch: "gevaarlijk", english: "dangerous", gender: null, example: "Het is gevaarlijk om hier te zwemmen.", exampleEn: "It's dangerous to swim here." },
  { dutch: "veilig", english: "safe", gender: null, example: "Hier kun je veilig oversteken.", exampleEn: "You can cross safely here." },
  { dutch: "gezond", english: "healthy", gender: null, example: "Groente is heel gezond.", exampleEn: "Vegetables are very healthy." },
  { dutch: "lekker", english: "tasty / nice", gender: null, example: "Dit brood is echt lekker.", exampleEn: "This bread is really tasty." },
  { dutch: "saai", english: "boring", gender: null, example: "De film was nogal saai.", exampleEn: "The film was rather boring." },

  // Time & direction words
  { dutch: "nu", english: "now", gender: null, example: "We moeten nu vertrekken.", exampleEn: "We have to leave now." },
  { dutch: "straks", english: "later (soon)", gender: null, example: "Ik bel je straks even.", exampleEn: "I'll call you in a bit." },
  { dutch: "altijd", english: "always", gender: null, example: "Hij komt altijd te laat.", exampleEn: "He's always late." },
  { dutch: "nooit", english: "never", gender: null, example: "Ik ben nog nooit in Parijs geweest.", exampleEn: "I've never been to Paris." },
  { dutch: "soms", english: "sometimes", gender: null, example: "Soms regent het de hele dag.", exampleEn: "Sometimes it rains all day." },
  { dutch: "vaak", english: "often", gender: null, example: "We gaan vaak naar de markt.", exampleEn: "We often go to the market." },
  { dutch: "links", english: "left", gender: null, example: "Sla bij de kerk links af.", exampleEn: "Turn left at the church." },
  { dutch: "rechts", english: "right", gender: null, example: "De bakker zit aan de rechterkant.", exampleEn: "The bakery is on the right." },
  { dutch: "hier", english: "here", gender: null, example: "Kom je hier vaak?", exampleEn: "Do you come here often?" },
  { dutch: "daar", english: "there", gender: null, example: "Daar staat je fiets.", exampleEn: "Your bike is over there." },
];

// 1. Curated core: rich entries (translation + de/het gender + example).
const ids = new Set<string>();
const curated: DictionaryEntry[] = [];
for (const e of ENTRIES) {
  const id = e.dutch.toLowerCase();
  if (ids.has(id)) continue;
  ids.add(id);
  curated.push({ id, ...e });
}

// 2. The rest of the FreeDict dictionary: real translations, no gender/example.
const generated: DictionaryEntry[] = [];
for (const [dutch, english] of GENERATED) {
  const id = dutch.toLowerCase();
  if (ids.has(id)) continue;
  ids.add(id);
  generated.push({ id, dutch, english, gender: null, example: "", exampleEn: "" });
}

/** The full bundled dictionary — curated (rich) words first, then the rest. */
export const DICTIONARY: DictionaryEntry[] = [...curated, ...generated];

/** Count of words that carry an example sentence (the curated core). */
export const RICH_COUNT = curated.length;

const BY_ID = new Map(DICTIONARY.map((e) => [e.id, e]));
export function findEntry(id: string): DictionaryEntry | undefined {
  return BY_ID.get(id);
}
