import { HStack, LayoutHeader } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Button } from "@astryxdesign/core/Button";
import { Text } from "@astryxdesign/core/Text";
import { SIGN_IN_URL, START_URL } from "../links";

export function SiteHeader() {
  return (
    <LayoutHeader role="banner" padding={3}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <HStack gap={2} vAlign="center">
          <img src="/debo.svg" alt="" width={40} height={40} />
          <Text type="large" weight="bold">
            Debo
          </Text>
        </HStack>
        <HStack gap={3} vAlign="center">
          <Link href={SIGN_IN_URL}>Sign in</Link>
          <Button label="Start free" variant="primary" href={START_URL} />
        </HStack>
      </HStack>
    </LayoutHeader>
  );
}
