import { Card, HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Badge } from "@astryxdesign/core/Badge";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Panel } from "./panel";

const STEPS = [
  {
    step: "1",
    title: "Write",
    body: "Add a journal entry whenever you like. A line or a page. It is saved in your own journal.",
  },
  {
    step: "2",
    title: "Ask",
    body: "Ask a plain question, like “When did Riya move to Pune?” Debo looks only at what you wrote.",
  },
  {
    step: "3",
    title: "See the source",
    body: "Every answer links to the entry it came from. If there is no source, Debo says it does not know.",
  },
  {
    step: "4",
    title: "Fix what Debo knows",
    body: "Debo picks out short memories from your entries. You can read each one, correct it, or forget it.",
  },
];

export function HowItWorks() {
  return (
    <Panel
      id="how"
      title="How Debo works"
      intro="Four small steps. You stay in charge of each one."
    >
      <Grid columns={{ minWidth: 220 }} gap={4}>
        {STEPS.map((item) => (
          <Card key={item.step} padding={5} variant="muted">
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <Badge variant="yellow" label={`Step ${item.step}`} />
              </HStack>
              <Heading level={3}>{item.title}</Heading>
              <Text as="p" color="secondary">
                {item.body}
              </Text>
            </VStack>
          </Card>
        ))}
      </Grid>
      <Card padding={5} variant="green">
        <VStack gap={2}>
          <Text type="label" weight="semibold">
            An example of an answer
          </Text>
          <Text as="p">
            “Riya moved to Pune in March.”
          </Text>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting">Source:</Text>
            <Badge variant="success" label="Your journal entry, 4 April" />
          </HStack>
        </VStack>
      </Card>
    </Panel>
  );
}
