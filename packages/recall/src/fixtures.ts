// The recall test set: made-up journal entries for one made-up person (Leela),
// and questions whose right entries are known. Never put real data here.
//
// Question kinds:
// - "keyword": shares a name, place or number with its entry.
// - "meaning": a paraphrase that shares no useful word with its entry, so
//   only meaning search can find it.
// - "absent": not in the journal at all; search must return nothing.

export type FixtureEntry = { key: string; text: string };
export type QuestionKind = "keyword" | "meaning" | "absent";
export type FixtureQuestion = {
  question: string;
  kind: QuestionKind;
  /** Keys of the entries that must all be found. Empty for "absent". */
  expect: string[];
};

export const entries: FixtureEntry[] = [
  {
    key: "e01",
    text: "4 January 2026\n\nStarted a pottery class at the community centre on Thursday evenings. The teacher is Ms. Halvorsen. My first bowl collapsed on the wheel and everyone laughed, including me.",
  },
  {
    key: "e02",
    text: "12 January 2026\n\nSaw Dr. Imani Reyes this morning. She says my iron is low, which explains the tiredness. Take the supplements for three months and come back in April.",
  },
  {
    key: "e03",
    text: "20 January 2026\n\nNoor's birthday dinner at Saffron Lane. She turned 31. I gave her a green wool scarf and she wore it straight away.",
  },
  {
    key: "e04",
    text: "2 February 2026\n\nThe boiler broke again, no hot water for two days. Viktor the plumber came and replaced the pressure valve. It cost 185 pounds.",
  },
  {
    key: "e05",
    text: "14 February 2026\n\nBiscuit chewed right through a sofa cushion while I was out. Stuffing all over the floor. Ordered a new cover online.",
  },
  {
    key: "e06",
    text: "27 February 2026\n\nSigned the lease for the flat on Juniper Road. Rent is 1,150 a month, starting 1 April. The landlord is Mr. Okonjo.",
  },
  {
    key: "e07",
    text: "8 March 2026\n\nRan my first 10k at the Riverside race. Finished in 58 minutes. Knees sore but very proud.",
  },
  {
    key: "e08",
    text: "15 March 2026\n\nGot promoted to senior analyst at Brightwell Insurance. My new manager is Priya. Celebrated with pizza.",
  },
  {
    key: "e09",
    text: "29 March 2026\n\nMoved into Juniper Road today. Boxes everywhere. Dad helped carry the bookshelf up three flights of stairs.",
  },
  {
    key: "e10",
    text: "10 April 2026\n\nThe results are back: iron is normal again. Dr. Reyes said I can stop the tablets.",
  },
  {
    key: "e11",
    text: "22 April 2026\n\nBooked flights to Lisbon with Noor for 12 to 19 June. Found a small hotel in Alfama.",
  },
  {
    key: "e12",
    text: "3 May 2026\n\nStarted Portuguese lessons on an app, fifteen minutes a day before breakfast. Obrigada is the only word I am sure of.",
  },
  {
    key: "e13",
    text: "18 May 2026\n\nArgued with Priya about the quarterly report deadline. We agreed to move it to 30 May.",
  },
  {
    key: "e14",
    text: "14 June 2026\n\nLisbon. Ate custard tarts at Belém, rode tram 28 up the hill, got sunburnt on my shoulders.",
  },
  {
    key: "e15",
    text: "1 July 2026\n\nBiscuit had his yearly jabs at Oakfield vet. He weighs 14 kg now. The vet says fewer treats.",
  },
  {
    key: "e16",
    text: "19 July 2026\n\nGrandma Ruth turned 90. Party in her back yard in Harrogate. She told the story of meeting Grandpa at a dance hall in 1956.",
  },
  {
    key: "e17",
    text: "5 August 2026\n\nDecided: no coffee after noon. I keep lying awake until 2am.",
  },
  {
    key: "e18",
    text: "23 August 2026\n\nLent Sam my camping tent for his trip to the Lakes. He promised to bring it back by the end of September.",
  },
  {
    key: "e19",
    text: "10 September 2026\n\nThe car failed its MOT because of worn brake pads. The garage on Mill Street fixed it for 240.",
  },
  {
    key: "e20",
    text: "2 October 2026\n\nFirst Saturday morning volunteering at the food bank. Sorted tins for three hours.",
  },
  {
    key: "e21",
    text: "25 October 2026\n\nSam returned the tent at last. One pole is bent.",
  },
];

export const questions: FixtureQuestion[] = [
  // Keyword: names, places, numbers.
  { kind: "keyword", question: "What did Viktor fix?", expect: ["e04"] },
  { kind: "keyword", question: "How much is the rent on Juniper Road?", expect: ["e06"] },
  { kind: "keyword", question: "When are the Lisbon flights?", expect: ["e11"] },
  { kind: "keyword", question: "What did Dr. Reyes say about my iron?", expect: ["e02", "e10"] },
  { kind: "keyword", question: "How heavy is Biscuit?", expect: ["e15"] },
  { kind: "keyword", question: "Why did the car fail its MOT?", expect: ["e19"] },
  { kind: "keyword", question: "Who is Ms. Halvorsen?", expect: ["e01"] },
  { kind: "keyword", question: "What did Priya and I agree about the quarterly report?", expect: ["e13"] },
  { kind: "keyword", question: "Where was Grandma Ruth's party?", expect: ["e16"] },

  // Meaning: paraphrases with no shared useful word.
  { kind: "meaning", question: "What did the GP advise about my anaemia?", expect: ["e02"] },
  { kind: "meaning", question: "Has my pet ever wrecked any furniture?", expect: ["e05"] },
  { kind: "meaning", question: "When was I given a career step up?", expect: ["e08"] },
  { kind: "meaning", question: "Have I entered any long-distance jogging events?", expect: ["e07"] },
  { kind: "meaning", question: "What present did I get my sister?", expect: ["e03"] },
  { kind: "meaning", question: "Have there been any heating problems in the house?", expect: ["e04"] },
  { kind: "meaning", question: "What changes have I made to rest better at night?", expect: ["e17"] },
  { kind: "meaning", question: "Do I do any charity work?", expect: ["e20"] },
  { kind: "meaning", question: "Did anyone borrow my outdoor gear?", expect: ["e18"] },
  { kind: "meaning", question: "Which foreign language am I studying?", expect: ["e12"] },
  { kind: "meaning", question: "What pastries did I try on holiday?", expect: ["e14"] },
  { kind: "meaning", question: "How did my grandmother and grandfather get together?", expect: ["e16"] },

  // Absent: nothing in the journal answers these.
  { kind: "absent", question: "What is my passport number?", expect: [] },
  { kind: "absent", question: "When is my dentist appointment?", expect: [] },
  { kind: "absent", question: "What did I plant in the vegetable patch?", expect: [] },
  { kind: "absent", question: "How much did the wedding cost?", expect: [] },
  { kind: "absent", question: "What is my cat called?", expect: [] },
];
