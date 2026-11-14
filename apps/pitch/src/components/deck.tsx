import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { APP_URL } from "../links";
import { TOUCH } from "../touch";
import { Band } from "./band";
import { DemoVideo } from "./demo-video";
import { Cards, Intro, Para, Placeholder, Src } from "./parts";
import { Phone } from "./phone";
import { PDF_AVAILABLE } from "../content/pdf";

export function DeckHero() {
  return (
    <Band id="hero">
      <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={8} align="center">
        <VStack gap={6}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <img src="/debo.svg" alt="Debo, a small red tomato" width={120} height={120} />
            <Badge variant="neutral" label="Pitch deck, November 2026" />
          </HStack>
          <VStack gap={4}>
            <Heading level={1} type="display-1" weight="bold" id="hero-title" textWrap="balance">
              A friendly assistant that remembers your life
            </Heading>
            <Text type="large" weight="normal" as="p" color="secondary" textWrap="pretty">
              Debo keeps your journal, voice notes and plans, and answers questions about your own life by text or
              voice. Every answer shows the entry it came from. You can see, fix and delete everything it knows.
            </Text>
            <Text type="large" weight="normal" as="p" color="secondary" textWrap="pretty">
              Live today as an early version at my.debo.life. Built by one founder. Raising to pay for the AI that
              each person uses, and to open Debo up carefully.
            </Text>
          </VStack>
          <HStack gap={3} wrap="wrap">
            <Button label="Try the app" variant="primary" size="lg" href="/try" style={TOUCH} />
            <Button label="Use cases" variant="secondary" size="lg" href="/use-cases" style={TOUCH} />
            {PDF_AVAILABLE ? (
              <Button label="Download the deck (PDF)" variant="secondary" size="lg" href="/debo-pitch-deck.pdf" style={TOUCH} />
            ) : null}
          </HStack>
        </VStack>
        <Card variant="red" padding={6}>
          <VStack hAlign="center">
            <Phone
              src="/shots/chat-light.webp"
              width={780}
              height={767}
              alt="The Debo app. A person asks what they planted on the balcony. Debo answers: basil and mint, with a source chip that reads Journal, 11 November."
              isPriority
            />
          </VStack>
        </Card>
      </Grid>
    </Band>
  );
}

export function Problem() {
  return (
    <Band id="problem" variant="muted">
      <Intro
        id="problem"
        badge="1. Problem"
        title="Your life is spread across a dozen places, and the AI you ask does not really know you"
        lead="This is the founder's view of the problem. We have not run a survey, so we do not quote a statistic here."
      />
      <Cards
        items={[
          { title: "You cannot find your own past", body: "What the doctor said in March, when you last spoke to a friend, what you promised your mother. It is in chats, notes, photos and your head." },
          { title: "General assistants forget, or guess", body: "A chat assistant may remember a few facts, but it often cannot show where a fact came from. You cannot tell a memory from a made-up answer." },
          { title: "Personal data is a big thing to hand over", body: "A tool that holds your diary and voice must be clear about where it goes, and let you fix and delete it. Most do not make that easy to see." },
        ]}
      />
    </Band>
  );
}

export function Insight() {
  return (
    <Band id="insight">
      <Intro
        id="insight"
        badge="2. Insight"
        title="For something this personal, trust is the product"
        lead="People will only keep their life in one place if they can check it. So every answer carries its source, and nothing is hidden."
      />
      <Cards
        items={[
          { title: "No source, no answer", body: "Debo answers only from what the person wrote or said, shows a chip for each entry it used, and says \"I don't have anything about that yet\" when it has nothing." },
          { title: "Glass box, not black box", body: "A page lists every memory with its source. The person can fix or forget each one, and a record shows what Debo read and did." },
          { title: "Speak the way you speak", body: "Many people in India mix Hindi and English in one sentence. Debo's voice is built on speech models that handle English, Hindi and a mix. How well they do on real Hinglish is not yet tested." },
        ]}
      />
    </Band>
  );
}

export function Solution() {
  return (
    <Band id="solution" variant="muted">
      <Intro
        id="solution"
        badge="3. Solution"
        title="One assistant that keeps your life and can act on it, with your yes"
      />
      <Cards
        items={[
          { title: "Journal and recordings", badge: "Built", badgeVariant: "success", body: "Write entries, or record a voice note or video. The words are written out and kept as an entry. Recordings are built and tested with stand-ins; a first real-world check is still to do." },
          { title: "Ask about your life", badge: "Built", badgeVariant: "success", body: "Ask in plain words, by text. Answers show their source chips." },
          { title: "Talk to Debo", badge: "Built, partly tested", badgeVariant: "info", body: "Speak in English, Hindi or a mix and hear the answer. Tested in the web app with a fake microphone; not yet on a real phone." },
          { title: "What Debo knows", badge: "Built", badgeVariant: "success", body: "Every memory, with its source. Fix it or forget it." },
          { title: "Connected apps and a browser", badge: "Built, needs live tests", badgeVariant: "info", body: "Through Composio, Debo can read from apps such as Gmail. Anything that sends, posts or changes waits for a yes on screen. Voice can never give that yes. Debo can also browse the public web." },
          { title: "Companion and role-play", badge: "Planned", badgeVariant: "warning", body: "A warmer, more playful character for people who want a friend, with firm safety rules. Today Debo has an editable name and tone, and a mascot with moods. The companion mode itself is not built." },
        ]}
      />
    </Band>
  );
}

const SHOTS = [
  { src: "/shots/journal-light.webp", w: 780, h: 933, title: "Journal", alt: "The Debo journal. Entries from 11 November sit in a list, each with the buttons Change entry and Delete entry.", text: "Write or record. Edit and delete any entry." },
  { src: "/shots/chat-light.webp", w: 780, h: 767, title: "Ask", alt: "The Debo chat. A person asks what they planted on the balcony and Debo answers with a source chip.", text: "Answers with a chip for every source." },
  { src: "/shots/knows-light.webp", w: 780, h: 1067, title: "What Debo knows", alt: "The What Debo knows page. A memory with its source chip and the buttons Fix this memory and Forget this memory.", text: "Every memory, with fix and forget." },
  { src: "/shots/talk-light.webp", w: 780, h: 833, title: "Talk", alt: "The Talk to Debo screen. A status line reads: Microphone off, Debo is not listening. A button says Start talking.", text: "Speak, with a clear microphone light." },
  { src: "/shots/apps-light.webp", w: 780, h: 1067, title: "Apps", alt: "The Apps screen in Debo, with Gmail and Google Calendar listed as not connected yet.", text: "Connect apps one at a time." },
];

export function Product() {
  return (
    <Band id="product">
      <Intro
        id="product"
        badge="4. Product"
        title="What it looks like today"
        lead="Real screenshots of the app at my.debo.life, with made-up demo entries."
      />
      <Grid columns={{ minWidth: 220, repeat: "fit" }} gap={5} align="start">
        {SHOTS.map((shot) => (
          <VStack key={shot.src} gap={3} hAlign="center">
            <Phone src={shot.src} width={shot.w} height={shot.h} alt={shot.alt} />
            <VStack gap={1} hAlign="center">
              <Text weight="bold" as="p">
                {shot.title}
              </Text>
              <Text type="supporting" as="p" color="secondary">
                {shot.text}
              </Text>
            </VStack>
          </VStack>
        ))}
      </Grid>
    </Band>
  );
}

export function Demo() {
  return (
    <Band id="demo" variant="muted">
      <Intro id="demo" badge="5. Demo" title="Watch it, then try it yourself" />
      <DemoVideo />
      <HStack gap={3} wrap="wrap">
        <Button label="Get a demo login" variant="primary" href="/try" style={TOUCH} />
        <Button label="Open the app" variant="secondary" href={APP_URL} style={TOUCH} />
      </HStack>
    </Band>
  );
}

export function WhyNow() {
  return (
    <Band id="why-now">
      <Intro
        id="why-now"
        badge="6. Why now"
        title="The AI got cheap, India went online in its own languages, and the old memory gadgets are fading"
      />
      <Cards
        items={[
          {
            title: "AI cost fell by a factor of ten",
            body: (
              <>
                Claude Haiku 5.5 lists at $0.10 input and $0.50 output per million tokens. Haiku 4.5 lists at $1 and $5.
                That is what makes a daily question on a small budget possible.{" "}
                <Src href="https://platform.claude.com/docs/en/about-claude/pricing">Anthropic pricing, 14 Nov 2026</Src>
              </>
            ),
          },
          {
            title: "India is online, in its own languages",
            body: (
              <>
                886 million active internet users in 2024, 98% of them reading content in Indian languages; a later
                report puts the number above 950 million.{" "}
                <Src href="https://bestmediainfo.com/insights/rural-india-makes-up-55-of-the-886-million-internet-users-in-2024-report-8628510">IAMAI-Kantar via BestMediaInfo</Src>,{" "}
                <Src href="https://www.businesstoday.in/amp/technology/news/story/indias-internet-user-base-tops-950-million-as-rural-growth-ai-drive-adoption-513353-2026-01-29">Business Today, Jan 2026</Src>
              </>
            ),
          },
          {
            title: "Talking to an AI is now a habit",
            body: (
              <>
                OpenAI says India has about 100 million weekly ChatGPT users, and its India head has said India is now its
                largest market. Both are company statements reported by the press.{" "}
                <Src href="https://www.techrepublic.com/article/news-india-100-million-weekly-chatgpt-users/">TechRepublic</Src>,{" "}
                <Src href="https://inc42.com/buzz/india-becomes-chatgpts-largest-market-globally-user-base-doubles-since-january/">Inc42</Src>
              </>
            ),
          },
          {
            title: "Standalone memory gadgets are consolidating",
            body: (
              <>
                Meta bought Limitless (formerly Rewind) in December 2025 and stopped selling its pendant to new
                customers. The need is real; the independent apps struggled.{" "}
                <Src href="https://www.neowin.net/amp/meta-acquires-ai-startup-limitless-ending-sales-of-its-popular-pendant-wearable/">Neowin</Src>
              </>
            ),
          },
        ]}
      />
    </Band>
  );
}

export function MarketSummary() {
  return (
    <Band id="market-summary" variant="muted">
      <Intro
        id="market-summary"
        badge="7. Market"
        title="A bottom-up view: start with people who already use an AI assistant weekly"
        lead="We start with the 100 million weekly ChatGPT users in India (a sourced floor for people who use an AI assistant) and apply a share who would keep a personal memory assistant. The share and the price are our assumptions, set out and adjustable on the market page."
      />
      <HStack>
        <Button label="See the sizing, with sources" variant="primary" href="/market" style={TOUCH} />
      </HStack>
    </Band>
  );
}

export function BusinessModel() {
  return (
    <Band id="business-model">
      <Intro
        id="business-model"
        badge="8. Business model"
        title="Free by invitation, then a monthly plan that covers what each person's AI costs"
        lead="Prices are a proposal and are not decided. The point of the model is that every tier is priced above its own cost at its own limits. The numbers are on the unit economics page."
      />
      <Cards
        items={[
          { title: "Invited, free", body: "Small caps. Text and voice notes only. No voice calls or browser.", badge: "Proposal", badgeVariant: "warning" },
          { title: "Founding, $6 a month", body: "First paid cohort with voice minutes and some browser time.", badge: "Proposal", badgeVariant: "warning" },
          { title: "Plus, $15 a month", body: "More voice, browser and connected apps, with fair limits.", badge: "Proposal", badgeVariant: "warning" },
        ]}
      />
      <HStack>
        <Button label="Unit economics and formulas" variant="primary" href="/economics" style={TOUCH} />
      </HStack>
    </Band>
  );
}

export function GoToMarketSummary() {
  return (
    <Band id="gtm-summary" variant="muted">
      <Intro
        id="gtm-summary"
        badge="9. Go to market"
        title="No free mass launch. Invite people in small groups, and let funding set the pace"
        lead="AI costs real money for every active person, so we grow as fast as we can pay for it: a waitlist, hard daily limits, a small paid founding group, then wider after funding."
      />
      <HStack>
        <Button label="Read the plan" variant="primary" href="/go-to-market" style={TOUCH} />
      </HStack>
    </Band>
  );
}

export function CompetitionSummary() {
  return (
    <Band id="competition">
      <Intro
        id="competition"
        badge="10. Competition"
        title="Big assistants add memory; companion apps add warmth; journals add safety. Few show their sources"
        lead="A fair, sourced comparison is on the market page. Our position is a combination, not a feature nobody else could copy."
      />
      <HStack>
        <Button label="See the comparison" variant="primary" href="/market" style={TOUCH} />
      </HStack>
    </Band>
  );
}

export function Moat() {
  return (
    <Band id="moat" variant="muted">
      <Intro
        id="moat"
        badge="11. Moat"
        title="What we are building to be hard to copy"
        lead="Honest note: these are early positions, not locked-in advantages. A large company could copy a feature. What is slow to copy is a pile of one person's trusted history and a product built around trust from the start."
      />
      <Cards
        items={[
          { title: "Personal memory with sources", body: "The longer someone uses Debo, the more it knows about them, and every fact points to its original. Leaving means leaving that record behind (though they can download it)." },
          { title: "Trust and data control", body: "See, fix, download and delete everything, a public privacy page that admits what is still unchecked, and no ads or selling of data. This is a brand promise that is hard to add late." },
          { title: "Voice in Hindi, English and Hinglish", body: "A voice path built for mixed speech from day one, on providers that handle it. Quality on real speech is still to be measured." },
          { title: "Approvals before actions", body: "Anything that sends, posts, pays or deletes needs a yes on screen, and voice can never give it. This makes it safe to let Debo do more." },
        ]}
      />
    </Band>
  );
}

export function Traction() {
  return (
    <Band id="traction">
      <Intro
        id="traction"
        badge="12. Traction"
        title="What is true today, and nothing more"
        lead="We have not opened Debo to the public. We do not claim users, revenue or testimonials, because there are none to claim."
      />
      <Cards
        items={[
          { title: "The product is live", body: <>The early version runs at <Src href={APP_URL}>my.debo.life</Src>, with sign-in.</> },
          { title: "Built by one founder", body: "Shaswat Raj wrote the whole codebase on his own." },
          { title: "Features shipped", body: "Journal, answers with sources, memories you can fix and forget, activity record, export and delete, voice notes and videos, talking by voice, connected apps with approvals, a browser. Some of these are built and tested with stand-ins and still need a first test against the real services. See the diligence page." },
        ]}
      />
      <Placeholder what="Traction numbers, if any: waitlist size, pilot users, retention. Do not add numbers that are not measured" />
    </Band>
  );
}

export function Roadmap() {
  return (
    <Band id="roadmap" variant="muted">
      <Intro id="roadmap" badge="13. Roadmap" title="What comes next, in order" lead="From the repository's own roadmap and notes. None of this is promised to a date." />
      <Cards
        items={[
          { title: "Now: make it safe to invite people", body: "Confirm which Mem0 plan Debo is on, and that it does not train on entries. Check the voice providers' data terms. Run recordings against the real storage and speech services. Measure real cost per person.", badge: "Next", badgeVariant: "info" },
          { title: "Then: charge fairly", body: "Plans and payments through a hosted checkout, monthly limits shown to the person, a founding paid cohort.", badge: "Next", badgeVariant: "info" },
          { title: "Then: the phone", body: "Recording and speaking inside the phone app, tested on real devices. Hindi and mixed-speech quality tests.", badge: "Planned", badgeVariant: "warning" },
          { title: "Later: companion mode and more", body: "A companion character with safety rules, quick capture from messaging apps, use Debo's memory from other AI tools, on-this-day and weekly look-backs.", badge: "Planned", badgeVariant: "warning" },
        ]}
      />
    </Band>
  );
}

export function Team() {
  return (
    <Band id="team">
      <Intro id="team" badge="14. Team" title="One founder" />
      <Card variant="muted" padding={5}>
        <VStack gap={2}>
          <Heading level={3}>Shaswat Raj, founder</Heading>
          <Para>Sole author of the Debo codebase.</Para>
        </VStack>
      </Card>
      <Placeholder what="Founder bio and background" />
      <Placeholder what="Advisors, early hires or co-founders, if any" />
    </Band>
  );
}

export function Ask() {
  return (
    <Band id="ask" variant="muted">
      <Intro
        id="ask"
        badge="15. The ask and use of funds"
        title="Fund the AI behind each person, and open Debo up carefully"
        lead="Because AI costs grow with every active person, money is what lets us invite people at all. These are the things funding pays for, in the order we would spend it."
      />
      <Placeholder what="Amount being raised" />
      <Placeholder what="Valuation or cap, and the instrument (for example SAFE)" />
      <Placeholder what="Percent split of the use of funds across the lines below" />
      <Cards
        items={[
          { title: "AI and voice usage", body: "The monthly bill for model, voice, speech and browser time for invited and paying people, within the daily and monthly limits on the unit economics page." },
          { title: "Safety and trust work", body: "Checking each provider's data terms, a proper privacy policy reviewed by someone qualified, a security review, and the companion safety rules." },
          { title: "Phone app and voice quality", body: "Real-device testing, in-app recording and speaking, and measured Hindi and Hinglish quality." },
          { title: "Payments and company set-up", body: "Plans, a hosted checkout, tax and legal set-up for charging people in India and abroad." },
          { title: "People", body: "A first engineer or designer, and part-time help for community and support. Number to be decided by the founder." },
        ]}
      />
    </Band>
  );
}
