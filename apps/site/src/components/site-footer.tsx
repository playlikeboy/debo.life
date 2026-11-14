import { TOUCH } from "../touch";
import { HStack, LayoutFooter, VStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { PRIVACY_URL, SIGN_IN_URL, START_URL } from "../links";

export function SiteFooter() {
  return (
    <LayoutFooter role="contentinfo" padding={0}>
      <Center axis="horizontal" paddingInline={5} paddingBlock={6}>
      <VStack gap={3} width="100%" maxWidth={1120}>
        <HStack gap={2} wrap="wrap">
          <Button label="Start free" variant="ghost" href={START_URL} style={TOUCH} />
          <Button label="Sign in" variant="ghost" href={SIGN_IN_URL} style={TOUCH} />
          <Button label="Privacy" variant="ghost" href={PRIVACY_URL} style={TOUCH} />
        </HStack>
        <Text type="supporting" as="p" color="secondary">
          Debo is an early version. Made to be a kind, honest place for your memories.
        </Text>
      </VStack>
      </Center>
    </LayoutFooter>
  );
}
