// A target list of investors to approach. These are NOT current investors and NOT endorsements.
// Public pages only. A cheque size is given only when a public page states it; otherwise it says so.
export type Target = {
  name: string;
  kind: string;
  stage: string;
  cheque: string;
  fit: string;
  href: string;
  hrefLabel: string;
  evidence?: { href: string; label: string };
};

export const CHECKED_ON = "14 November 2026";

export const FUNDS: Target[] = [
  {
    name: "Peak XV Surge",
    kind: "Seed program and fund",
    stage: "Seed, earliest stage",
    cheque: "$500,000 to $5 million, as stated on its page",
    fit: "Targets \"day-zero founders\" at the earliest stage. Peak XV's Surge led the $2.5 million seed round in Companion Labs, an Indian consumer AI startup.",
    href: "https://surge.peakxv.com/",
    hrefLabel: "Surge, with application",
    evidence: { href: "https://entrackr.com/snippets/peak-xv-leads-25-mn-round-in-companion-labs-11157241", label: "Entrackr on Companion Labs" },
  },
  {
    name: "India Quotient",
    kind: "Early-stage fund",
    stage: "Pre-seed and seed",
    cheque: "No fixed range on its page (examples from 150K to 2M, currency not stated)",
    fit: "Lists consumer as a focus, invests before there are customers, and asks for a link to a working product or a demo rather than a deck. Debo is live.",
    href: "https://www.indiaquotient.in/",
    hrefLabel: "India Quotient",
  },
  {
    name: "Blume Ventures",
    kind: "Early-stage fund",
    stage: "Pre-seed to Series A",
    cheque: "Roughly $500K to $5M, according to a third-party summary, not its own page",
    fit: "Active across AI and consumer, and publishes a guide to who writes the first cheque in India.",
    href: "https://blume.vc/",
    hrefLabel: "Blume Ventures",
    evidence: { href: "https://blume.vc/commentaries/indias-micro-vc-landscape-whos-writing-the-first-cheque-in-2026", label: "Blume on India's micro VC landscape" },
  },
  {
    name: "Accel India",
    kind: "VC",
    stage: "Seed to Series A",
    cheque: "$1M to $15M according to a third-party summary, not its own page",
    fit: "Lists consumer and AI. A later-seed fit once there is early usage.",
    href: "https://www.accel.com/",
    hrefLabel: "Accel",
    evidence: { href: "https://www.peony.ink/blog/top-investors-india", label: "Peony summary of Indian investors" },
  },
  {
    name: "Lightspeed India",
    kind: "VC",
    stage: "Seed to growth",
    cheque: "Not found on a public page",
    fit: "Lists consumer and AI among its sectors, per a third-party summary.",
    href: "https://lsvp.com/",
    hrefLabel: "Lightspeed",
    evidence: { href: "https://www.peony.ink/blog/top-investors-india", label: "Peony summary of Indian investors" },
  },
  {
    name: "Elevation Capital",
    kind: "VC",
    stage: "Early stage",
    cheque: "Not found on a public page",
    fit: "Launched a $500 million Fund IX to back AI-led startups, per press.",
    href: "https://elevation.com/",
    hrefLabel: "Elevation Capital",
    evidence: { href: "https://inc42.com/buzz/elevation-capital-launches-fund-ix-with-500-mn-corpus-to-back-ai-led-startups/", label: "Inc42 on Fund IX" },
  },
  {
    name: "100X.VC",
    kind: "Early-stage fund",
    stage: "Early stage",
    cheque: "Not stated on its home page",
    fit: "Says it was the first to invest using India SAFE notes, a founder-friendly instrument.",
    href: "https://100x.vc/",
    hrefLabel: "100X.VC",
  },
  {
    name: "ConsumerX Ventures",
    kind: "Consumer fund",
    stage: "Early stage",
    cheque: "A reported 150 crore rupee fund; cheque size not found",
    fit: "A consumer-focused fund, per press. Debo is a consumer product.",
    href: "https://www.consumerx.vc/",
    hrefLabel: "ConsumerX",
    evidence: { href: "https://www.outlookbusiness.com/corporate/consumerx-ventures-bets-150-cr-on-indias-next-consumer-start-ups", label: "Outlook Business on ConsumerX" },
  },
  {
    name: "Sauce.VC",
    kind: "Micro VC",
    stage: "Early stage",
    cheque: "Not found on a public page",
    fit: "Listed under consumer focus in Blume's guide to micro VCs.",
    href: "https://www.sauce.vc/",
    hrefLabel: "Sauce.VC",
  },
  {
    name: "Silicon Road Ventures",
    kind: "AI fund",
    stage: "Early stage",
    cheque: "Not found",
    fit: "Reported to have launched an $18 million India-focused AI fund with a path to the US. We did not find its own page, only press.",
    href: "https://www.pulse.bot/venture-capital/news/silicon-road-ventures-launches-18-m-indiafocused-ai-fund-with-us-expansion-pathway-0069a662-e6db-41aa-84a6-1df56077d4e3/",
    hrefLabel: "Press report",
  },
];

export const ACCELERATORS: Target[] = [
  {
    name: "Y Combinator",
    kind: "Accelerator",
    stage: "Pre-seed and seed",
    cheque: "$500,000: $125,000 for 7% on a post-money SAFE plus $375,000 on an uncapped MFN SAFE, as stated on its deal page",
    fit: "Standard terms are public, which makes the cost of taking the deal easy to model.",
    href: "https://www.ycombinator.com/apply",
    hrefLabel: "Apply to YC",
    evidence: { href: "https://www.ycombinator.com/deal", label: "YC standard deal" },
  },
  {
    name: "Antler India",
    kind: "Pre-seed investor and builder",
    stage: "Pre-seed",
    cheque: "Not stated on its page",
    fit: "Its pre-seed page says it works with pre-seed investors in your location. India is one of its locations.",
    href: "https://www.antler.co/pitch",
    hrefLabel: "Pitch Antler",
  },
  {
    name: "Entrepreneur First",
    kind: "Talent investor",
    stage: "Pre-team and pre-idea",
    cheque: "Not checked",
    fit: "Invests in individuals before a team exists; a possible fit if the founder wants a co-founder. Not checked whether it runs in India.",
    href: "https://www.joinef.com/",
    hrefLabel: "Entrepreneur First",
  },
  {
    name: "Techstars",
    kind: "Accelerator",
    stage: "Pre-seed and seed",
    cheque: "Varies by program, not checked",
    fit: "Global network with programs in different cities. Check the current list for one that fits.",
    href: "https://www.techstars.com/accelerators",
    hrefLabel: "Techstars programs",
  },
  {
    name: "Google for Startups Accelerator, India",
    kind: "Accelerator",
    stage: "Seed to Series A",
    cheque: "Non-dilutive, program terms not checked",
    fit: "Mentorship and Google cloud and AI support; check whether the current call is for AI companies.",
    href: "https://startup.google.com/programs/accelerator/india/",
    hrefLabel: "Google for Startups India",
  },
  {
    name: "Startup India Seed Fund Scheme",
    kind: "Government scheme",
    stage: "Idea to early stage",
    cheque: "Not checked; funding goes through approved incubators",
    fit: "Non-dilutive and government-backed. Requires a registered Indian company.",
    href: "https://seedfund.startupindia.gov.in/",
    hrefLabel: "Seed Fund Scheme",
  },
];

export const ANGELS: Target[] = [
  { name: "Indian Angel Network", kind: "Angel network", stage: "Early", cheque: "Not checked", fit: "An angel network in India. Not checked in detail.", href: "https://www.indianangelnetwork.com/", hrefLabel: "Indian Angel Network" },
  { name: "Mumbai Angels", kind: "Angel network", stage: "Early", cheque: "Not checked", fit: "An angel network. Not checked how it takes applications.", href: "https://www.mumbaiangels.com/", hrefLabel: "Mumbai Angels" },
  { name: "LetsVenture", kind: "Angel platform", stage: "Early", cheque: "Not checked", fit: "An online platform that connects startups with angel investors.", href: "https://www.letsventure.com/", hrefLabel: "LetsVenture" },
  { name: "Inflection Point Ventures", kind: "Angel network", stage: "Early", cheque: "Not checked", fit: "An angel network. Not checked in detail.", href: "https://www.ipventures.in/", hrefLabel: "Inflection Point Ventures" },
];

export const CREDITS: Target[] = [
  { name: "Anthropic startup program", kind: "Credits", stage: "Any", cheque: "Not checked", fit: "Debo's answers run on Claude Haiku. Credits would cover real usage cost directly.", href: "https://www.anthropic.com/startups", hrefLabel: "Anthropic for startups" },
  { name: "Cloudflare for Startups", kind: "Credits", stage: "Any", cheque: "Not checked", fit: "Debo runs on Cloudflare: Workers, Containers, R2 and Workers AI.", href: "https://www.cloudflare.com/forstartups/", hrefLabel: "Cloudflare for Startups" },
];
