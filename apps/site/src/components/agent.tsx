import { Card, HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Badge } from "@astryxdesign/core/Badge";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Panel } from "./panel";

const JOBS = [
  {
    title: "Look things up online",
    body: "Open a website for you, find what you asked for, and bring it back.",
  },
  {
    title: "Work on documents",
    body: "Read a document, draft a reply, or fill in a form.",
  },
  {
    title: "Keep your goals",
    body: "Remember what you want to get done and check in on it with you.",
  },
];

export function Agent() {
  return (
    <Panel
      id="agent"
      title="Debo can do things, with your OK"
      intro="Soon Debo will be able to do small jobs for you, not only answer questions."
    >
      <VStack gap={4}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge variant="warning" label="Coming soon" />
          <Text type="supporting">Not built yet. We will say so here when it is.</Text>
        </HStack>
        <Grid columns={{ minWidth: 220 }} gap={4}>
          {JOBS.map((job) => (
            <Card key={job.title} padding={5} variant="muted">
              <VStack gap={2}>
                <Heading level={3}>{job.title}</Heading>
                <Text as="p" color="secondary">
                  {job.body}
                </Text>
              </VStack>
            </Card>
          ))}
        </Grid>
        <Card padding={5} variant="green">
          <VStack gap={2}>
            <Heading level={3}>Debo will always ask first</Heading>
            <Text as="p">
              Before Debo sends, posts, pays, deletes or changes anything outside Debo, it will show you what it
              plans to do and wait for a clear yes. You can say no.
            </Text>
          </VStack>
        </Card>
      </VStack>
    </Panel>
  );
}
