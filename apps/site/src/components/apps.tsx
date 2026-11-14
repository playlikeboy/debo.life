import { VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Badge } from "@astryxdesign/core/Badge";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "./band";
import { Phone } from "./phone";

export function Apps() {
  return (
    <Band id="apps" variant="muted">
      <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={8} align="center">
        <VStack hAlign="center">
          <Phone
            src="/shots/apps-light.webp"
            width={780}
            height={1067}
            alt="The Apps screen in Debo, with Gmail and Google Calendar listed as not connected yet."
          />
        </VStack>
        <VStack gap={4} hAlign="start">
          <Badge variant="warning" label="Coming soon" />
          <Heading level={2} type="display-2" weight="bold" id="apps-title" textWrap="balance">
            Connect your apps
          </Heading>
          <Text type="large" weight="normal" as="p" color="secondary" textWrap="pretty">
            Later, you will be able to let Debo read from places like your mail and calendar, so it can answer
            from more than your journal. This is being built and is not ready to use.
          </Text>
          <Text as="p" type="large" weight="normal" color="secondary" textWrap="pretty">
            Debo will ask you first, and will tell you what it wants to read and why. Before it sends, posts,
            pays, deletes or changes anything outside Debo, it will wait for a clear yes.
          </Text>
        </VStack>
      </Grid>
    </Band>
  );
}
