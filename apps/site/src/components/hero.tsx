import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { SIGN_IN_URL, START_URL } from "../links";

export function Hero() {
  return (
    <Grid columns={{ minWidth: 260 }} gap={8} align="center">
      <VStack gap={5}>
        <Heading level={1} type="display-3" textWrap="balance">
          A friendly assistant that remembers your life
        </Heading>
        <Text type="large" as="p" color="secondary">
          Write things down or say them out loud. Later, ask Debo anything about your own past and plans. Every
          answer shows where it came from.
        </Text>
        <HStack gap={3} wrap="wrap">
          <Button label="Start free" variant="primary" size="lg" href={START_URL} />
          <Button label="Sign in" variant="secondary" size="lg" href={SIGN_IN_URL} />
        </HStack>
        <Text type="supporting" as="p">
          Debo is an early version. Some parts are still being built, and this page says which.
        </Text>
      </VStack>
      <VStack hAlign="center">
        <img
          src="/debo.svg"
          alt="Debo, a round yellow character with big dark eyes and pink cheeks"
          width={240}
          height={240}
        />
      </VStack>
    </Grid>
  );
}
