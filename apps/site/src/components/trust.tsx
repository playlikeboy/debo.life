import { TOUCH } from "../touch";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Heading, Text } from "@astryxdesign/core/Text";
import { PRIVACY_URL } from "../links";
import { Band } from "./band";

// Every line here matches apps/web/src/app/privacy/page.tsx. Change them together.
const FACTS = [
  {
    title: "Where it lives",
    body: "Your account, entries and files are stored with Neon, in the United States. Your memories are stored with Mem0. Cloudflare runs this website.",
  },
  {
    title: "Who sees it",
    body: "You can read your entries. Debo’s servers read them so they can search and answer. To write an answer, the matching pieces go to an AI company, and the privacy page names each one.",
  },
  {
    title: "Take it with you",
    body: "Download everything as plain files that open without Debo.",
  },
  {
    title: "Delete it",
    body: "Delete any entry, and the memories made from it go a few seconds later. You can also delete all your data.",
  },
];

export function Trust() {
  return (
    <Band id="trust">
      <VStack gap={3} maxWidth={640} hAlign="start">
        <Badge variant="neutral" label="Your data" />
        <Heading level={2} type="display-2" weight="bold" id="trust-title" textWrap="balance">
          It is your life. You stay in charge of it.
        </Heading>
        <Text type="large" weight="normal" as="p" color="secondary" textWrap="pretty">
          Debo keeps personal things, so here is what happens to them, in plain words.
        </Text>
      </VStack>
      <Grid columns={{ minWidth: 240, repeat: "fit" }} gap={4}>
        {FACTS.map((fact) => (
          <Card key={fact.title} variant="muted" padding={5}>
            <VStack gap={2}>
              <Heading level={3}>{fact.title}</Heading>
              <Text as="p" type="large" weight="normal" color="secondary" textWrap="pretty">
                {fact.body}
              </Text>
            </VStack>
          </Card>
        ))}
      </Grid>
      <Card variant="gray" padding={6}>
        <VStack gap={3} maxWidth={720}>
          <Heading level={3}>Honest limits</Heading>
          <Text as="p" type="large" weight="normal" textWrap="pretty">
            Debo is an early version. It is not end-to-end encrypted, because its servers have to read your
            entries to search them. We do not sell your data, show ads, or train AI on it ourselves. Some
            companies that help Debo may keep data for a time, and we have not yet confirmed all of their rules.
            The privacy page says which.
          </Text>
          <HStack>
            <Button label="Read how Debo handles your data" variant="primary" href={PRIVACY_URL} style={TOUCH} />
          </HStack>
        </VStack>
      </Card>
    </Band>
  );
}
