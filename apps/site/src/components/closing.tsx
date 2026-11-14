import { TOUCH } from "../touch";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { START_URL } from "../links";
import { Band } from "./band";

export function Closing() {
  return (
    <Band id="start">
      <Card variant="red" padding={10}>
        <VStack gap={5} hAlign="center">
          <img src="/debo.svg" alt="Debo, a small red tomato" width={168} height={168} loading="lazy" />
          <VStack gap={3} hAlign="center" maxWidth={560}>
            <Heading level={2} type="display-2" weight="bold" id="start-title" justify="center" textWrap="balance">
              Start with one line about today
            </Heading>
            <Text type="large" weight="normal" as="p" justify="center" textWrap="balance">
              Write it down. Ask about it later. Debo will show you where the answer came from.
            </Text>
          </VStack>
          <HStack gap={3} wrap="wrap" hAlign="center">
            <Button label="Start free" variant="primary" size="lg" href={START_URL} style={TOUCH} />
          </HStack>
        </VStack>
      </Card>
    </Band>
  );
}
