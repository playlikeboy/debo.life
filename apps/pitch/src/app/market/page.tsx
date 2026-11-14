import type { Metadata } from "next";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "../../components/band";
import { Cards, Estimate, Intro, Para, Src } from "../../components/parts";
import { Shell } from "../../components/shell";
import { MARKET } from "../../content/economics";

export const metadata: Metadata = { title: "Market and competition" };

const money = (n: number): string => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)} billion` : `$${Math.round(n / 1e6)} million`);

export default function Market() {
  return (
    <Shell>
      <Band id="sizing">
        <Intro
          id="sizing"
          badge="Market"
          title="Sizing from the bottom up"
          lead="Start with people who already use an AI assistant every week, then take the share who would keep a personal memory assistant, then the yearly price. Only the first number is sourced. The rest are assumptions you can change in apps/pitch/src/content/economics.ts."
        />
        <Cards
          items={[
            {
              title: "Sourced: people using an AI assistant weekly in India",
              body: (
                <>
                  About 100 million weekly ChatGPT users in India, as stated by OpenAI. This counts one product only, so it is a floor.{" "}
                  <Src href="https://www.techrepublic.com/article/news-india-100-million-weekly-chatgpt-users/">TechRepublic</Src>
                </>
              ),
            },
            {
              title: "Sourced: the wider internet base",
              body: (
                <>
                  886 million active internet users in 2024, 55% rural, 98% using Indian languages. A later report counts about 950 million.{" "}
                  <Src href="https://bestmediainfo.com/insights/rural-india-makes-up-55-of-the-886-million-internet-users-in-2024-report-8628510">IAMAI-Kantar via BestMediaInfo</Src>,{" "}
                  <Src href="https://www.businesstoday.in/amp/technology/news/story/indias-internet-user-base-tops-950-million-as-rural-growth-ai-drive-adoption-513353-2026-01-29">Business Today</Src>
                </>
              ),
            },
          ]}
        />
        <Heading level={3}>
          India-only revenue potential <Estimate />
        </Heading>
        <Para>Formula: 100 million x share who would pay x yearly price. The shares and prices below are assumptions, not research.</Para>
        <Grid columns={{ minWidth: 260, repeat: "fit" }} gap={4}>
          {MARKET.yearlyPrices.flatMap((price) =>
            MARKET.shares.map((share) => (
              <Card key={`${price}-${share}`} variant="muted" padding={5}>
                <VStack gap={1}>
                  <Badge variant="orange" label="Estimate" />
                  <Text as="p" type="large" weight="semibold">
                    {share * 100}% pay ${price} a year
                  </Text>
                  <Text as="p" type="large">
                    {money(MARKET.weeklyChatGptUsersIndia * share * price)} a year
                  </Text>
                </VStack>
              </Card>
            )),
          )}
        </Grid>
        <Para>
          This is a serviceable market for India alone, not a forecast of what Debo will earn. Prices in India are lower than in rich
          countries, and the first customers may be abroad, among Indians living overseas and anyone who journals. We have not sized
          those groups and do not guess.
        </Para>
      </Band>

      <Band id="rivals" variant="muted">
        <Intro
          id="rivals"
          badge="Competition"
          title="Who else is near this, and how we differ"
          lead="What each product does is from its own public page where we could read it. The last line of each card is our own view. We list limits of our checking where there are any."
        />
        <Grid columns={{ minWidth: 300, repeat: "fit" }} gap={4} align="start">
          {[
            {
              name: "ChatGPT with memory and voice",
              doing: "A general assistant with a memory feature and voice. Used by about 100 million people a week in India alone (see above).",
              us: "A giant with reach. Our difference is narrower: answers that show the entry they came from, a page to see and fix every memory, and approval for actions. We do not claim they lack all of these.",
              href: "https://help.openai.com/en/articles/8590148-memory-faq",
              src: "OpenAI memory help page",
            },
            {
              name: "Replika",
              doing: "An AI friend app. Its site says it has 42 million users worldwide (its own claim) and that it \"always remembers what matters\".",
              us: "Strong on companionship. We start from a different place: a personal record with sources. We would enter companionship later, with safety rules first.",
              href: "https://replika.com/",
              src: "replika.com",
            },
            {
              name: "Pi (Inflection)",
              doing: "A conversational assistant. We could not read its site automatically, so we do not describe its features.",
              us: "We have not compared in detail.",
              href: "https://pi.ai/",
              src: "pi.ai",
            },
            {
              name: "Rewind and Limitless",
              doing: "Recorded and searched what you see and hear. Meta bought Limitless in December 2025 and stopped selling the pendant to new customers; the Rewind Mac app's capture was reported to be turned off in December 2025.",
              us: "Shows that the need is real and that always-on capture is hard to sustain. Debo records only when the person presses the button, and says so on screen.",
              href: "https://www.neowin.net/amp/meta-acquires-ai-startup-limitless-ending-sales-of-its-popular-pendant-wearable/",
              src: "Neowin",
            },
            {
              name: "Notion AI",
              doing: "AI inside a notes and documents workspace, for people who already keep their notes there.",
              us: "Built for teams and documents. Debo is for one person's life, with voice, and no setup of pages. We have not compared features in detail.",
              href: "https://www.notion.com/product/ai",
              src: "notion.com/product/ai",
            },
            {
              name: "Day One",
              doing: "A journaling app. Its site lists audio recordings, photos, an On This Day view and end-to-end encryption. The page we read did not mention AI features.",
              us: "Day One is strong on privacy and craft. Debo is not end-to-end encrypted, because its servers must read entries to search and answer them. This is a real trade-off and we say so. Debo adds answering questions with sources and voice conversation.",
              href: "https://www.dayoneapp.com/",
              src: "dayoneapp.com",
            },
            {
              name: "Friend and other companion gadgets",
              doing: "Wearable AI companions. We did not research their features or sales.",
              us: "Hardware costs and always-on listening raise privacy questions. Debo is software and listens only when the screen says so.",
              href: "https://www.friend.com/",
              src: "friend.com",
            },
            {
              name: "Indian companion and Indic-language players",
              doing: "Companion Labs, a Bengaluru consumer AI startup for vernacular entertainment, raised a $2.5 million seed round led by Peak XV's Surge in February 2026. We did not survey others.",
              us: "Shows investor interest in Indian consumer AI in Indian languages. Companion Labs is about entertainment; Debo is about a personal record.",
              href: "https://entrackr.com/snippets/peak-xv-leads-25-mn-round-in-companion-labs-11157241",
              src: "Entrackr",
            },
          ].map((rival) => (
            <Card key={rival.name} padding={5}>
              <VStack gap={2} hAlign="start">
                <Heading level={3}>{rival.name}</Heading>
                <Para>{rival.doing}</Para>
                <Text as="p" type="large" weight="semibold">
                  Our view
                </Text>
                <Para>{rival.us}</Para>
                <Src href={rival.href}>{rival.src}</Src>
              </VStack>
            </Card>
          ))}
        </Grid>
        <Para>Last checked 14 November 2026. Companies change fast: verify before relying on any line above.</Para>
      </Band>
    </Shell>
  );
}
