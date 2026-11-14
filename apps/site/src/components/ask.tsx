import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Badge } from "@astryxdesign/core/Badge";
import { Token } from "@astryxdesign/core/Token";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "./band";

// Both exchanges are real replies from the demo account, set again here in
// larger type so they are easy to read. Nothing in them is made up.
function Question({ children }: { children: string }) {
  return (
    <HStack hAlign="end">
      <Card variant="blue" padding={4} maxWidth={360}>
        <Text as="p" type="large" weight="normal">{children}</Text>
      </Card>
    </HStack>
  );
}

export function Ask() {
  return (
    <Band id="ask" variant="muted">
      <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={8} align="center">
        <VStack gap={5}>
          <VStack gap={3} hAlign="start">
            <Badge variant="neutral" label="Step 2" />
            <Heading level={2} type="display-2" weight="bold" id="ask-title" textWrap="balance">
              Ask in plain words. See where the answer came from.
            </Heading>
            <Text type="large" weight="normal" as="p" color="secondary" textWrap="pretty">
              Debo answers only from what you wrote. Under every answer is a chip for each entry it used, with the
              date. Press a chip to open the original.
            </Text>
          </VStack>
          <VStack gap={2}>
            <Heading level={3}>No source, no guess</Heading>
            <Text as="p" type="large" weight="normal" color="secondary" textWrap="pretty">
              If Debo cannot find it, or the entry is unclear, Debo says so instead of making something up.
            </Text>
          </VStack>
        </VStack>
        <Card padding={6}>
          <VStack gap={5}>
            <Question>What did I plant on the balcony?</Question>
            <VStack gap={3}>
              <Text as="p" type="large" weight="normal">
                You planted basil and mint on the balcony. This comes from your journal entry from 11 November.
              </Text>
              <VStack gap={2}>
                <Text type="supporting" as="p" color="secondary">
                  Where this came from
                </Text>
                <HStack gap={2} wrap="wrap">
                  <Token label="Journal, 11 November" color="blue" />
                </HStack>
              </VStack>
            </VStack>
            <Divider />
            <Question>When is the launch now?</Question>
            <VStack gap={3}>
              <Text as="p" type="large" weight="normal">
                The latest note I can find is from 11 November 2026. It says the launch moved to &ldquo;next
                Friday&rdquo; because the payment page needs more testing. It doesn&rsquo;t give an exact date, so
                &ldquo;next Friday&rdquo; is ambiguous, and I don&rsquo;t have anything newer about the launch date.
              </Text>
              <HStack gap={2} wrap="wrap">
                <Token label="Journal, 11 November" color="blue" />
              </HStack>
            </VStack>
            <Text type="supporting" as="p" color="secondary">
              Real replies from a demo account, shown here in larger type.
            </Text>
          </VStack>
        </Card>
      </Grid>
    </Band>
  );
}
