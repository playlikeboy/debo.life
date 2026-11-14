import { TOUCH } from "../touch";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { START_URL } from "../links";
import { Band } from "./band";
import { Phone } from "./phone";

export function Hero() {
  return (
    <Band id="hero">
      <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={8} align="center">
        <VStack gap={6}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <img src="/debo.svg" alt="Debo, a small red tomato" width={120} height={120} />
            <Badge variant="neutral" label="Early version, free to start" />
          </HStack>
          <VStack gap={4}>
            <Heading level={1} type="display-1" weight="bold" id="hero-title" textWrap="balance">
              A friendly assistant that remembers your life
            </Heading>
            <Text type="large" weight="normal" as="p" color="secondary" textWrap="pretty">
              Write things down or say them out loud. Later, ask Debo about your own past and plans. Every answer
              shows the entry it came from.
            </Text>
          </VStack>
          <HStack gap={3} wrap="wrap">
            <Button label="Start free" variant="primary" size="lg" href={START_URL} style={TOUCH} />
            <Button label="See how it works" variant="secondary" size="lg" href="#write" style={TOUCH} />
          </HStack>
          <Text type="supporting" as="p" color="secondary">
            Some parts are still being built. This page says which.
          </Text>
        </VStack>
        <Card variant="red" padding={6}>
          <VStack hAlign="center">
            <Phone
              src="/shots/chat-light.webp"
              width={780}
              height={1688}
              alt="The Debo app. A person asks what they planted on the balcony. Debo answers: basil and mint, with a source chip that reads Journal, 11 November."
              isPriority
            />
          </VStack>
        </Card>
      </Grid>
    </Band>
  );
}
