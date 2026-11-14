import { Card, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { PRIVACY_URL } from "../links";
import { Panel } from "./panel";

const PROMISES = [
  {
    title: "You can see everything",
    body: "Every entry, chat and memory Debo has is on a page you can open.",
  },
  {
    title: "You can fix or forget it",
    body: "Correct a memory that is wrong. Forget one you do not want kept.",
  },
  {
    title: "Every answer shows its source",
    body: "Debo links to the entry it used. With no source, it says it does not know.",
  },
  {
    title: "You can take it with you",
    body: "Download everything as a zip of plain files. It opens without Debo.",
  },
  {
    title: "You can delete it all",
    body: "Delete your account and your entries, chats, memories and files go right away.",
  },
  {
    title: "We do not sell your data",
    body: "We do not sell it, share it for ads, or train AI on it ourselves.",
  },
];

export function Trust() {
  return (
    <Panel
      id="trust"
      title="What we promise"
      intro="Debo holds personal things, so we keep the promises short and true."
    >
      <Grid columns={{ minWidth: 240 }} gap={4}>
        {PROMISES.map((promise) => (
          <Card key={promise.title} padding={5} variant="green">
            <VStack gap={2}>
              <Heading level={3}>{promise.title}</Heading>
              <Text as="p">{promise.body}</Text>
            </VStack>
          </Card>
        ))}
      </Grid>
      <VStack gap={3}>
        <Heading level={3}>Honest limits</Heading>
        <Text as="p" color="secondary">
          Debo is not end-to-end encrypted. Its servers have to read your notes to search them. Some companies that
          help Debo may handle data in ways we cannot control. For example, the memory service we use says it may
          train its AI on data from some plans, and we have not yet confirmed which plan covers us. Until we do,
          assume it may.
        </Text>
        <Text as="p">
          Read the full details on the <Link href={PRIVACY_URL} type="inherit">privacy page</Link>.
        </Text>
      </VStack>
    </Panel>
  );
}
