import { VStack } from "@astryxdesign/core/Layout";
import { AspectRatio } from "@astryxdesign/core/AspectRatio";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "./band";

// A real screen recording of the live app, made with the demo account.
// Astryx has no video component, so this is a plain video element inside a Card.
export function Demo() {
  return (
    <Band id="demo" variant="muted">
      <VStack gap={3} maxWidth={640} hAlign="start">
        <Badge variant="neutral" label="Watch it, about a minute" />
        <Heading level={2} type="display-2" weight="bold" id="demo-title" textWrap="balance">
          See Debo being used
        </Heading>
        <Text type="large" weight="normal" as="p" color="secondary" textWrap="pretty">
          Sign in, write one line in the journal, ask Debo about it in chat, and get an answer with its source.
          Then a look at the voice screen and the apps screen. There is no sound.
        </Text>
      </VStack>
      <VStack hAlign="center" gap={3}>
        <Card padding={1.5} elevation="high" width="100%" maxWidth={360}>
          <AspectRatio ratio={468 / 1012} fit="cover">
          <video
            controls
            playsInline
            preload="none"
            muted
            width={468}
            height={1012}
            poster="/debo-demo-poster.webp"
            aria-label="A screen recording of the Debo app. A person signs in, writes a sample journal line, asks Debo where the item is and gets an answer with a source chip. Then the video shows the voice screen and the Apps screen. There is no sound."
          >
            <source src="/debo-demo.mp4" type="video/mp4" />
            <source src="/debo-demo.webm" type="video/webm" />
            Your browser cannot play this video.
          </video>
          </AspectRatio>
        </Card>
        <Text type="supporting" as="p" color="secondary" justify="center" textWrap="balance">
          Recorded in the live app with a demo account. The journal line is sample text and was deleted afterwards.
        </Text>
      </VStack>
    </Band>
  );
}
