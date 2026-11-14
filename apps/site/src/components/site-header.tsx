import { TOUCH } from "../touch";
import { HStack, LayoutHeader } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { SIGN_IN_URL, START_URL } from "../links";

export function SiteHeader() {
  return (
    <LayoutHeader role="banner" padding={0}>
      <Center axis="horizontal" paddingInline={5} paddingBlock={3}>
      <HStack hAlign="between" vAlign="center" gap={3} width="100%" maxWidth={1120}>
        <HStack gap={2} vAlign="center">
          <img src="/debo.svg" alt="" width={40} height={40} />
          <Text type="large" weight="bold">
            Debo
          </Text>
        </HStack>
        <HStack gap={2} vAlign="center">
          <Button label="Sign in" variant="ghost" href={SIGN_IN_URL} style={TOUCH} />
          <Button label="Start free" variant="primary" href={START_URL} style={TOUCH} />
        </HStack>
      </HStack>
      </Center>
    </LayoutHeader>
  );
}
