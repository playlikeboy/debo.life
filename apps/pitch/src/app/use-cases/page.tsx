import type { Metadata } from "next";
import { VStack } from "@astryxdesign/core/Layout";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "../../components/band";
import { Intro, Para } from "../../components/parts";
import { Shell } from "../../components/shell";

export const metadata: Metadata = { title: "Use cases" };

type Story = {
  who: string;
  title: string;
  story: string;
  works: string;
  status: "Built" | "Built, needs live tests" | "Planned";
  note?: string;
};

// Every story is a made-up example person. None is a real customer or testimonial.
const STORIES: Story[] = [
  {
    who: "Anita, 42, after a doctor visit",
    title: "What did the doctor say in March?",
    story: "Anita records a one-minute voice note in the car after the visit: the new tablet, the test in three months. In June she asks, \"What did the doctor say about my sugar test?\" Debo answers from her note and shows the chip \"Voice note, 14 March\". She taps it and listens to her own voice.",
    works: "Voice notes are written out and kept as entries, searched and cited. Debo only repeats what her own note says and does not give medical advice.",
    status: "Built, needs live tests",
    note: "Recording is built and tested with stand-ins. A first run against the real storage and speech service is still to do.",
  },
  {
    who: "Rohan, 28, with a busy family",
    title: "When did I last talk to Riya?",
    story: "Rohan jots down calls and promises: \"Riya moved to Pune in March\", \"Promised mum I would visit in December\". Later he asks about each person. Debo gathers what he wrote and shows where each fact came from, and he can fix a wrong memory or forget it.",
    works: "Journal entries, memories with sources on the What Debo knows page, fix and forget.",
    status: "Built",
    note: "A page that lists every person and what you said about them is planned, not built.",
  },
  {
    who: "Meera, 19, a student",
    title: "Where did I write that down?",
    story: "Meera writes quick notes after each class and adds the date. Before exams she asks, \"What did I note about the French Revolution causes?\" and gets her own notes back, with the days she wrote them, instead of a general answer from the internet.",
    works: "Journal entries and answers only from her own entries. Keyword and meaning search.",
    status: "Built",
    note: "A weekly look-back of what she studied is planned.",
  },
  {
    who: "Imran, who runs a small shop",
    title: "Say it once, find it later",
    story: "Between customers, Imran speaks into the app: \"Sharma ji took goods worth 1,500 on credit, will pay Friday.\" Next week he asks, \"Who owes me money?\" Debo answers from his notes with the dates.",
    works: "Speak-to-text dictation and voice notes, answers with sources. He can also ask Debo to look up a public page in the browser.",
    status: "Built, needs live tests",
    note: "This is a memory aid, not accounting software. How well Hindi and mixed speech are written out is not yet measured.",
  },
  {
    who: "Kamla, 68, speaks only Hindi",
    title: "A parent who just talks",
    story: "Kamla's son sets up the app once. After that she presses one button, speaks Hindi, and hears Debo answer out loud: \"What did I plan for Diwali?\" A clear line on screen says whether the microphone is on, and she can stop Debo by speaking over it.",
    works: "Talk to Debo in English, Hindi or a mix, with live captions and source chips. It uses a stock voice that reads Hindi.",
    status: "Built, needs live tests",
    note: "Tested in the web app with a fake microphone. Not yet tried on a real phone or with real Hindi speech.",
  },
  {
    who: "Priya, 35, with errands piling up",
    title: "Check my email, and ask before doing anything",
    story: "Priya asks, \"Find the school trip email.\" Debo reads it through her connected Gmail and shows the dates. She asks it to draft a reply. Debo prepares it, and nothing is sent until she presses yes on screen. Voice can never give that yes.",
    works: "Connected apps through Composio, reads run on their own, anything that sends or changes waits for an on-screen yes. A browser can read public pages.",
    status: "Built, needs live tests",
    note: "Tested with stand-ins and a fictional mailbox. Not yet accepted against a live account.",
  },
  {
    who: "Arjun, 24, lonely in a new city",
    title: "A friend who remembers",
    story: "Arjun wants to chat in the evening, to a character that is warm, a little playful, remembers his week, and is clear that it is not a person. It also knows when to point him to real people and help if he sounds in trouble.",
    works: "Today: Debo talks like a warm friend in chat and by voice, in English, Hindi or a mix. Asked to take a role, it keeps it across chats and calls until told to stop. The mascot shows moods. Safety rules are instructions to the AI model for now.",
    status: "Built, needs live tests",
    note: "We treat this as the riskiest use case. The rules in place and the ones still planned are on the diligence page.",
  },
];

export default function UseCases() {
  return (
    <Shell>
      <Band id="cases">
        <Intro
          id="cases"
          badge="Use cases"
          title="Everyday stories for ordinary people"
          lead="The people below are made-up examples, not customers. Each story says what works today and what does not."
        />
        <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={5} align="start">
          {STORIES.map((s) => (
            <Card key={s.title} variant="muted" padding={5}>
              <VStack gap={3} hAlign="start">
                <Badge
                  variant={s.status === "Built" ? "success" : s.status === "Planned" ? "warning" : "info"}
                  label={s.status === "Planned" ? "Planned, not built" : s.status}
                />
                <Text type="supporting" color="secondary" as="p">
                  {s.who}
                </Text>
                <Heading level={3}>{s.title}</Heading>
                <Para>{s.story}</Para>
                <Text as="p" type="large" weight="semibold">
                  What makes it work
                </Text>
                <Para>{s.works}</Para>
                {s.note ? (
                  <Text as="p" type="supporting" color="secondary">
                    {s.note}
                  </Text>
                ) : null}
              </VStack>
            </Card>
          ))}
        </Grid>
      </Band>
    </Shell>
  );
}
