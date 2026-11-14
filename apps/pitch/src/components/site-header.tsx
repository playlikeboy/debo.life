import { HStack, LayoutHeader, VStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { PAGES } from "../content/pages";
import { TOUCH } from "../touch";

export function SiteHeader() {
  return (
    <LayoutHeader role="banner" padding={0}>
      <Center axis="horizontal" paddingInline={5} paddingBlock={3}>
        <VStack gap={2} width="100%" maxWidth={1120}>
          <HStack gap={2} vAlign="center">
            <img src="/debo.svg" alt="" width={40} height={40} />
            <Text type="large" weight="bold">
              Debo
            </Text>
            <Text type="supporting" color="secondary">
              Investor pitch
            </Text>
          </HStack>
          <HStack as="nav" aria-label="Pitch pages" gap={1} wrap="wrap">
            {PAGES.map((page) => (
              <Button key={page.href} label={page.label} variant="ghost" size="sm" href={page.href} style={TOUCH} />
            ))}
          </HStack>
        </VStack>
      </Center>
    </LayoutHeader>
  );
}
