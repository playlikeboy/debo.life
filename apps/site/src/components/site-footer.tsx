import { HStack, LayoutFooter, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { PRIVACY_URL, SIGN_IN_URL, START_URL } from "../links";

export function SiteFooter() {
  return (
    <LayoutFooter role="contentinfo" padding={4}>
      <VStack gap={3}>
        <HStack gap={4} wrap="wrap">
          <Link href={START_URL}>Start free</Link>
          <Link href={SIGN_IN_URL}>Sign in</Link>
          <Link href={PRIVACY_URL}>Privacy</Link>
        </HStack>
        <Text type="supporting" as="p">
          Debo is an early version. Made to be a kind, honest place for your memories.
        </Text>
      </VStack>
    </LayoutFooter>
  );
}
