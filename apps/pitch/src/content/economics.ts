// Unit economics. Change a number here and every page that shows it updates.
// Prices are PUBLIC LIST PRICES read on CHECKED. Everything under USAGE, FIXED and TIERS is an ESTIMATE
// or a proposal, not a measurement: Debo has no paying users yet.

export const CHECKED = "14 November 2026";

export type Price = { id: string; what: string; value: number; unit: string; text: string; source: string; note?: string };

export const PRICES: Price[] = [
  {
    id: "haikuIn", what: "Claude Haiku 5.5, input (prompts up to 100,000 tokens)", value: 0.1, unit: "per million tokens",
    text: "$0.10", source: "https://platform.claude.com/docs/en/about-claude/pricing",
    note: "The model Debo uses today for answers. Prompts over 100,000 tokens cost more; Debo's prompts are far smaller.",
  },
  {
    id: "haikuOut", what: "Claude Haiku 5.5, output", value: 0.5, unit: "per million tokens",
    text: "$0.50", source: "https://platform.claude.com/docs/en/about-claude/pricing",
  },
  {
    id: "stt", what: "LiveKit Inference, Deepgram Nova-3 speech to text (multilingual, Build and Ship plans)", value: 0.0058, unit: "per minute",
    text: "$0.0058", source: "https://livekit.com/pricing",
  },
  {
    id: "tts", what: "LiveKit Inference, Cartesia Sonic-3 text to speech (Build and Ship plans)", value: 0.03, unit: "per minute",
    text: "$0.0300", source: "https://livekit.com/pricing",
    note: "The page lists per minute only. We use it as an upper bound per minute of call.",
  },
  {
    id: "session", what: "LiveKit agent session, over the plan's included minutes", value: 0.01, unit: "per minute",
    text: "$0.0100", source: "https://livekit.com/pricing",
    note: "Build plan ($0) includes 1,000 session minutes a month; Ship (from $50 a month) includes 5,000.",
  },
  {
    id: "whisper", what: "Cloudflare Workers AI, Whisper large v3 turbo (voice notes, videos, dictation)", value: 0.000513, unit: "per audio minute",
    text: "$0.000513", source: "https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/",
  },
  {
    id: "r2", what: "Cloudflare R2 storage (first 10 GB a month free)", value: 0.015, unit: "per GB-month",
    text: "$0.015", source: "https://developers.cloudflare.com/r2/pricing/",
    note: "Writes $4.50 per million, reads $0.36 per million, downloads to the internet free. Negligible here.",
  },
  {
    id: "cMem", what: "Cloudflare Containers, memory (25 GiB-hours a month included)", value: 0.0000025, unit: "per GiB-second",
    text: "$0.0000025", source: "https://developers.cloudflare.com/containers/pricing/",
  },
  {
    id: "cCpu", what: "Cloudflare Containers, CPU (375 vCPU-minutes a month included; billed on active use)", value: 0.00002, unit: "per vCPU-second",
    text: "$0.000020", source: "https://developers.cloudflare.com/containers/pricing/",
  },
  {
    id: "cDisk", what: "Cloudflare Containers, disk (200 GB-hours a month included)", value: 0.00000007, unit: "per GB-second",
    text: "$0.00000007", source: "https://developers.cloudflare.com/containers/pricing/",
    note: "Workers Paid plan, $5 a month, is required. Debo's browser container is standard-1 (1/2 vCPU, 4 GiB, 8 GB disk); its API container is basic (1/4 vCPU, 1 GiB, 4 GB).",
  },
  {
    id: "neonCu", what: "Neon Launch plan, compute", value: 0.106, unit: "per compute-unit hour",
    text: "$0.106", source: "https://neon.com/pricing",
  },
  {
    id: "neonGb", what: "Neon Launch plan, storage", value: 0.35, unit: "per GB-month",
    text: "$0.35", source: "https://neon.com/pricing",
  },
  {
    id: "composio", what: "Composio Standard plan, tool calls over the pooled 10,000 a month", value: 0.005, unit: "per call",
    text: "$0.005", source: "https://composio.dev/pricing",
    note: "Standard is $18 per seat a month. The free plan has 10,000 calls a month and stops there.",
  },
  {
    id: "mem0", what: "Mem0 platform, beyond the free allowance", value: Number.NaN, unit: "not published",
    text: "Not published", source: "https://mem0.ai/pricing",
    note: "The page lists a free plan (10,000 adds and 1,000 retrievals a month for the first 30 days) and a custom quote. No rate is shown, so the memory line below is a placeholder to replace with a real quote.",
  },
];

const p = (id: string): number => {
  const hit = PRICES.find((x) => x.id === id);
  if (!hit) throw new Error(`no price ${id}`);
  return hit.value;
};

/** ASSUMPTION: what one chat question costs in tokens. Retrieved pieces make the input large. */
export const TOKENS_IN_PER_QUESTION = 4000;
export const TOKENS_OUT_PER_QUESTION = 400;
/** ASSUMPTION: per person per month, for memory (Mem0). No public price: replace with a quote. */
export const MEM0_PLACEHOLDER_PER_USER = 0.3;
/** ASSUMPTION: how much of a voice call minute the cost lines are charged for (all of it = upper bound). */
export const VOICE_BRAIN_PER_MINUTE = 0.001;
/** Container cost of one hour with the browser container awake (upper bound: CPU at full use). */
export const BROWSER_HOUR = 4 * 3600 * p("cMem") + 0.5 * 3600 * p("cCpu") + 8 * 3600 * p("cDisk");
/** The same for the API container, if it is awake for a whole hour. */
export const API_HOUR = 1 * 3600 * p("cMem") + 0.25 * 3600 * p("cCpu") + 4 * 3600 * p("cDisk");

export type Usage = {
  questions: number;
  voiceMinutes: number;
  transcribeMinutes: number;
  storageGb: number;
  browserHours: number;
  toolCalls: number;
};

export type CostLine = { label: string; formula: string; dollars: number };

const POOLED_FREE_CALLS = 10000;

export function costLines(u: Usage, billableToolCallShare = 1): CostLine[] {
  const perQuestion = (TOKENS_IN_PER_QUESTION * p("haikuIn") + TOKENS_OUT_PER_QUESTION * p("haikuOut")) / 1_000_000;
  const perVoiceMinute = p("stt") + p("tts") + p("session") + VOICE_BRAIN_PER_MINUTE;
  return [
    { label: "Chat answers", formula: `questions x (${TOKENS_IN_PER_QUESTION} in x $${p("haikuIn")} + ${TOKENS_OUT_PER_QUESTION} out x $${p("haikuOut")}) / 1,000,000`, dollars: u.questions * perQuestion },
    { label: "Talking out loud", formula: `minutes x (speech to text + text to speech + session + $${VOICE_BRAIN_PER_MINUTE} for the answer) = minutes x $${perVoiceMinute.toFixed(4)}`, dollars: u.voiceMinutes * perVoiceMinute },
    { label: "Voice notes and videos written out", formula: `minutes x $${p("whisper")}`, dollars: u.transcribeMinutes * p("whisper") },
    { label: "Storing recordings", formula: `GB x $${p("r2")}`, dollars: u.storageGb * p("r2") },
    { label: "Browser time", formula: `hours x $${BROWSER_HOUR.toFixed(3)} (container awake, upper bound)`, dollars: u.browserHours * BROWSER_HOUR },
    { label: "Connected-app calls", formula: `calls x $${p("composio")} beyond the pooled free 10,000 (share billable: ${billableToolCallShare})`, dollars: u.toolCalls * p("composio") * billableToolCallShare },
    { label: "Memory (Mem0), placeholder", formula: `a flat $${MEM0_PLACEHOLDER_PER_USER} per person (no public price)`, dollars: MEM0_PLACEHOLDER_PER_USER },
  ];
}

export const total = (lines: CostLine[]): number => lines.reduce((a, l) => a + l.dollars, 0);
export const usd = (n: number): string => (n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);

export const PROFILES: { name: string; story: string; usage: Usage; billableShare: number }[] = [
  { name: "Light", story: "Writes a little, asks now and then.", usage: { questions: 20, voiceMinutes: 0, transcribeMinutes: 30, storageGb: 0.5, browserHours: 0, toolCalls: 10 }, billableShare: 0 },
  { name: "Typical", story: "Journals most days, talks to Debo a few times a month.", usage: { questions: 60, voiceMinutes: 15, transcribeMinutes: 60, storageGb: 2, browserHours: 1, toolCalls: 50 }, billableShare: 0 },
  { name: "Heavy", story: "Talks daily, adds recordings, lets Debo use the browser and apps.", usage: { questions: 300, voiceMinutes: 90, transcribeMinutes: 240, storageGb: 10, browserHours: 6, toolCalls: 300 }, billableShare: 1 },
];

/** Costs that do not grow with each person: the platform bills before the first user. Monthly, upper-bound estimates. */
export const FIXED: { label: string; dollars: number; formula: string }[] = [
  { label: "Cloudflare Workers Paid plan", dollars: 5, formula: "$5 flat, needed for Containers" },
  { label: "API container awake all month", dollars: API_HOUR * 730, formula: `730 hours x $${API_HOUR.toFixed(4)}, before the included allowances; it sleeps when idle, so less` },
  { label: "Neon database, light use", dollars: 0.25 * 730 * p("neonCu"), formula: `0.25 compute units x 730 hours x $${p("neonCu")}; scale-to-zero makes it less` },
  { label: "Neon storage, first GBs", dollars: 2 * p("neonGb"), formula: `2 GB x $${p("neonGb")}` },
];
export const FIXED_TOTAL = FIXED.reduce((a, f) => a + f.dollars, 0);

export type Tier = { name: string; price: number; line: string; usage: Usage; billableShare: number };

/** PROPOSAL, not a decision. docs/BYOK-AND-PLANS.md says prices are not set. Limits are what the price must cover. */
export const TIERS: Tier[] = [
  { name: "Invited, free", price: 0, line: "By invitation from the waitlist. Text and voice notes only, small caps.", usage: { questions: 100, voiceMinutes: 0, transcribeMinutes: 60, storageGb: 1, browserHours: 0, toolCalls: 20 }, billableShare: 0 },
  { name: "Founding", price: 6, line: "First paid cohort. Talk to Debo for a few minutes a day, some browser time.", usage: { questions: 300, voiceMinutes: 20, transcribeMinutes: 120, storageGb: 5, browserHours: 2, toolCalls: 100 }, billableShare: 0 },
  { name: "Plus", price: 15, line: "Everyday use of voice, the browser and connected apps, with fair monthly limits.", usage: { questions: 1000, voiceMinutes: 90, transcribeMinutes: 300, storageGb: 20, browserHours: 8, toolCalls: 500 }, billableShare: 1 },
];

/** ASSUMPTION: monthly AI and platform budgets the founder could fund before any investment. */
export const BUDGETS = [100, 500, 2000];

/** How many typical people a monthly budget keeps running. */
export function peopleFor(budget: number): number {
  const typical = total(costLines(PROFILES[1].usage, PROFILES[1].billableShare));
  return Math.max(0, Math.floor((budget - FIXED_TOTAL) / typical));
}

/** Bottom-up market sizing. Inputs are sourced where marked; shares and prices are assumptions to change. */
export const MARKET = {
  weeklyChatGptUsersIndia: 100_000_000,
  shares: [0.01, 0.03, 0.05],
  yearlyPrices: [36, 72],
};
