import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Badge } from "@astryxdesign/core/Badge";
import { Text } from "@astryxdesign/core/Text";
import { Panel } from "./panel";

export function Voice() {
  return (
    <Panel
      id="voice"
      title="Talk to Debo out loud"
      intro="Sometimes it is easier to say it than to type it. Press talk, ask your question, and Debo answers by voice."
    >
      <VStack gap={4}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Badge variant="success" label="Works today" />
          <Badge variant="neutral" label="English" />
          <Badge variant="neutral" label={<span lang="hi">हिन्दी</span>} />
        </HStack>
        <Text as="p">
          Speak in English or Hindi. Debo answers from your own entries, the same way it does when you type, and
          Debo does not record your voice.
        </Text>
        <Text as="p" color="secondary">
          One honest note. Your voice passes through other companies that turn speech into text and back again. We
          have not yet checked how long they keep audio. Until we do, assume they may keep it for a time. If that
          worries you, type instead.
        </Text>
      </VStack>
    </Panel>
  );
}
