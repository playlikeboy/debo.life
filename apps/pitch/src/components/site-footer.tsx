import { HStack, LayoutFooter, VStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { APP_URL, PRIVACY_URL, SITE_URL } from "../links";
import { TOUCH } from "../touch";

export function SiteFooter() {
  return (
    <LayoutFooter role="contentinfo" padding={0}>
      <Center axis="horizontal" paddingInline={5} paddingBlock={6}>
        <VStack gap={3} width="100%" maxWidth={1120}>
          <HStack gap={2} wrap="wrap">
            <Button label="Open the app" variant="ghost" href={APP_URL} style={TOUCH} />
            <Button label="About Debo" variant="ghost" href={SITE_URL} style={TOUCH} />
            <Button label="Privacy page" variant="ghost" href={PRIVACY_URL} style={TOUCH} />
          </HStack>
          <Text type="supporting" as="p" color="secondary">
            This page is for investors and is not listed in search engines. Debo is an early version, built by one
            founder. Numbers marked as estimates are estimates. Every outside number has its source beside it.
          </Text>
        </VStack>
      </Center>
    </LayoutFooter>
  );
}
