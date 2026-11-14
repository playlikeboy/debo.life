import type { Metadata } from "next";
import type { ReactNode } from "react";
import { VStack } from "@astryxdesign/core/Layout";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "../../components/band";
import { Cards, Intro, Para, Placeholder, Src } from "../../components/parts";
import { Shell } from "../../components/shell";
import { PRIVACY_URL, REPO_URL } from "../../links";

export const metadata: Metadata = { title: "Diligence answers" };

type Qa = { q: string; a: ReactNode };

function Faq({ items }: { items: Qa[] }) {
  return (
    <CollapsibleGroup type="multiple" hasDividers>
      {items.map((item, i) => (
        <Collapsible
          key={item.q}
          value={`q${i}`}
          trigger={
            <VStack paddingBlock={2}>
              <Text as="span" type="large">
                {item.q}
              </Text>
            </VStack>
          }
        >
          <Text as="div" type="large" weight="normal" color="secondary" textWrap="pretty">
            {item.a}
          </Text>
        </Collapsible>
      ))}
    </CollapsibleGroup>
  );
}

const PRIVACY: Qa[] = [
  {
    q: "Where is the data stored?",
    a: (
      <>
        Accounts, entries and files live with Neon in the United States (AWS us-east-2). Memories live with Mem0, which says it stores data with
        hosting providers in the United States and other countries. Recordings of voice notes and videos are in a private Cloudflare R2 bucket
        with no public address. Cloudflare runs the app. This matches the <Src href={PRIVACY_URL}>public privacy page</Src>, which is the master copy.
      </>
    ),
  },
  {
    q: "Which companies see pieces of a person's data?",
    a: "Neon's AI gateway (models run by Databricks) turns entry text and questions into numbers for search. Anthropic writes the answers from the matching pieces of entries, with the Neon gateway as a fallback. Mem0 receives entry text to pick out memories, and uses AI providers such as OpenAI and Anthropic. LiveKit carries voice calls, with Deepgram (speech to text) and Cartesia (text to speech). Cloudflare Workers AI (Whisper) writes out recordings and dictation. Composio carries requests to connected apps.",
  },
  {
    q: "Is anyone training AI on user data?",
    a: "We do not, and we do not sell or share data or show ads. Anthropic's business terms say it may not train on what we send; it deletes it within 30 days unless a safety check flags it (up to 2 years) or the law requires it. Databricks says it does not train on what paying customers send, and may keep text up to 30 days to spot abuse. Cloudflare says Workers AI content is not used for training and is not kept after the request. Composio says it does not use request data to train AI, and deletes logs after one year. Two items below are still open.",
  },
  {
    q: "Open item: Mem0 may train on free plan data",
    a: "Mem0's privacy policy says it trains its AI models on data from free plan users, and not on paid plan users. We have not yet confirmed which covers Debo's account. Until we do, the privacy page tells people to assume Mem0 may train on what Debo sends it. Confirming the plan, or moving to a paid plan with a data processing addendum, is on our roadmap before inviting real people.",
  },
  {
    q: "Open item: voice providers' terms are not verified",
    a: "We have not yet checked LiveKit's, Deepgram's or Cartesia's terms on training AI and on how long they keep audio. Until we do, the privacy page says to assume they may keep it for a time, and that people who worry should type instead. Debo itself does not record voice during a call. Transcripts are kept only if the person leaves \"Keep voice transcripts\" on.",
  },
  {
    q: "Other limits we state publicly",
    a: "Debo is not end-to-end encrypted, because the servers must read entries to search them. The database provider may keep backups for a short time and we have not stated the period. Mem0 does not say how long it keeps data after deletion. We have not checked whether Cloudflare keeps a backup copy of a deleted recording. A full privacy policy checked by someone qualified comes before Debo opens fully.",
  },
  {
    q: "Can a person take their data or delete it?",
    a: "Yes. Download everything from the app (entries, memories and a link for each recording), delete any entry (its recording and memories go too), or delete all data. In the new app, deleting data does not yet delete the account itself or chats from the older website; the privacy page says so. Deleting an app connection removes it at Composio.",
  },
  {
    q: "What did we check, and when?",
    a: "Anthropic's, Neon's and Databricks' terms on 10 November 2026. Composio's policy on 14 November 2026. Prices for this site on 14 November 2026.",
  },
];

const SAFETY: Qa[] = [
  {
    q: "Is the companion persona built?",
    a: "No. Today Debo has an editable name and tone and a mascot with moods. A companion or role-play mode is planned, and we will not ship it before the safety rules below exist.",
  },
  {
    q: "What rules would it follow?",
    a: "Our product rules already say Debo never pretends to be a person, gives no medical, legal or financial advice, never guesses facts about a person's life, and never acts outside Debo without a clear yes. A companion mode would add: an on-screen reminder that it is an AI; no claims to feel pain or to need the person; no encouragement of dependence or secrecy; a plain pointer to real people and to local help if a person talks about hurting themselves; extra care with anyone who says they are a minor; and clear controls to turn the persona off and delete the chat history. These are plans. They are not built or tested.",
  },
  {
    q: "Is any of this checked by an expert?",
    a: "Not yet. Before a companion mode ships we intend to have it reviewed by someone qualified in child safety and mental health, and to restrict it to adults at first. That is an intention, not a done step.",
  },
];

const RISKS: Qa[] = [
  { q: "Risk: AI cost grows faster than revenue", a: "Hard per-person limits, invite-only growth, a plan priced above its own limits, and provider spend caps. See the go to market and unit economics pages. Voice is the biggest cost, so it is capped first." },
  { q: "Risk: a big platform copies memory", a: "True and likely. Our answer is trust (sources, control, honest limits) and voice for Indian languages, built in from the start. We do not claim a technical secret." },
  { q: "Risk: a leak or a broken promise", a: "Every database query on user data filters by user id, secrets are never logged, logs hold ids not text, actions outside Debo need an on-screen yes, and the privacy page admits what is unchecked. We have not had an outside security review." },
  { q: "Risk: wrong answers", a: "Answers come only from the person's own entries, with a source, and say \"I don't have anything about that yet\" when nothing matches. A test set of made-up entries and questions is run before releases. Quality on real, long histories is not yet measured." },
  { q: "Risk: dependence on a few providers", a: "Model calls go through one package, with Anthropic first and a fallback. Speech and memory sit behind small interfaces so another provider can replace them. Mem0 and LiveKit are the least easy to swap." },
  { q: "Risk: one person builds everything", a: "Real. The code is readable, documented, and tested with stand-ins. Funding adds a first engineer. See the team and ask sections of the deck." },
  { q: "Risk: voice and Hindi quality", a: "Not yet measured on real speech. A test with real speakers comes before voice is promoted." },
];

const TECH: Qa[] = [
  { q: "What is it built on?", a: "TypeScript. The app is an Expo and React Native app that runs on the web, iOS and Android; the server is Hono. Data is in Neon Postgres with pgvector for search by meaning. It runs on Cloudflare: Workers, Containers (an API container and a browser container with Chromium) and R2. Answers use Claude Haiku 5.5 through the Vercel AI SDK, with Neon's AI gateway as a fallback. Voice runs on LiveKit Agents. Memory is hosted Mem0. Connected apps go through Composio. The sign-in is Neon Auth." },
  { q: "Is any of the code from someone else?", a: <>The agent platform in the new app (the "os" folder) started from CopilotKit&rsquo;s open-source OpenFuse template under the MIT licence, recorded in the repository&rsquo;s THIRD_PARTY_NOTICES. Debo does not use its brand, name or mascot. The journal, memory, voice and trust parts are Debo&rsquo;s own. Repository: <Src href={REPO_URL}>github.com/playlikeboy/debo.life</Src>.</> },
  { q: "What is tested, and what is not?", a: "Typecheck, unit tests with stand-ins, and a recall test set. Several features were run end to end only with a fake bucket and fake speech engine: journal recordings, speaking into text, and voice from the new app. Not yet run for real: Cloudflare R2 and Workers AI, ffmpeg in the container, Whisper quality on Hindi and mixed speech, phone code on a device, a live Gmail account. The documents in the repository list each one." },
];

export default function Diligence() {
  return (
    <Shell>
      <Band id="privacy">
        <Intro id="privacy" badge="Diligence" title="Data privacy and where data goes" lead={<>Plain answers to what investors ask. The master text is the <Src href={PRIVACY_URL}>privacy page</Src>; if this page and that one disagree, that one is right.</>} />
        <Faq items={PRIVACY} />
      </Band>

      <Band id="architecture" variant="muted">
        <Intro id="architecture" badge="Architecture" title="How the parts fit" lead="In order from the person to the services behind them." />
        <Cards
          min={240}
          items={[
            { title: "1. The person", body: "The Debo app in a browser or on a phone, at my.debo.life. Draft entries stay on the device until saved." },
            { title: "2. Cloudflare", body: "A Worker serves the app. The API runs in a small container. A second container runs Chromium for the browser feature. An optional Linux workspace exists but is off." },
            { title: "3. The brain", body: "One answer pipeline: search the person's own entries (words and meaning), check the daily limit, ask the model to answer only from those pieces, return the answer with source ids." },
            { title: "4. Neon", body: "Postgres: accounts, entries, pieces for search, chats, usage counts, the activity record." },
            { title: "5. Cloudflare R2 and Workers AI", body: "Private bucket for recordings, Whisper to write the words out." },
            { title: "6. Mem0", body: "Memories picked out of entries, each linked to its entry." },
            { title: "7. Anthropic", body: "Claude Haiku 5.5 writes answers. Neon's AI gateway is the fallback." },
            { title: "8. LiveKit", body: "Carries voice calls. Deepgram hears, Cartesia speaks. The agent asks the same brain for answers." },
            { title: "9. Composio", body: "Connects apps such as Gmail. Reads run. Changes wait for an on-screen yes." },
          ]}
        />
      </Band>

      <Band id="tech">
        <Intro id="tech" badge="Technical" title="Technology, code and what is tested" />
        <Faq items={TECH} />
      </Band>

      <Band id="safety" variant="muted">
        <Intro id="safety" badge="Safety" title="Safety of the companion persona" lead="This is a plan, because the persona is not built." />
        <Faq items={SAFETY} />
      </Band>

      <Band id="risks">
        <Intro id="risks" badge="Risks" title="Risks and what we do about them" />
        <Faq items={RISKS} />
      </Band>

      <Band id="costs" variant="muted">
        <Intro id="costs" badge="Costs" title="What it costs to run" lead="See the unit economics page for every price, its source and the formulas. Short version: chat is cheap on Claude Haiku 5.5, voice is the main cost, recordings and storage are small, and the browser is a modest hourly cost." />
      </Band>

      <Band id="legal">
        <Intro id="legal" badge="Company" title="Legal and company status" lead="We do not state any company registration or legal fact here until the founder supplies it." />
        <Placeholder what="Company entity: name, type, country and date of registration (or: not yet registered)" />
        <Placeholder what="Who owns the code and the Debo name, and any trademark filings" />
        <Placeholder what="Cap table and any prior funding (or: none)" />
        <Placeholder what="Contact email for investors" />
        <Heading level={3}>Other legal items we know about</Heading>
        <Para>
          A full privacy policy checked by someone qualified is promised before Debo opens fully. India&rsquo;s data protection law and
          rules for taking payments from users have not been reviewed by a lawyer for this site.
        </Para>
      </Band>
    </Shell>
  );
}
