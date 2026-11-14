import type { ReactNode } from "react";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";

/** The heading block that opens every band. */
export function Intro({ id, badge, title, lead }: { id: string; badge: string; title: string; lead?: ReactNode }) {
  return (
    <VStack gap={3} maxWidth={760} hAlign="start">
      <Badge variant="neutral" label={badge} />
      <Heading level={2} type="display-2" weight="bold" id={`${id}-title`} textWrap="balance">
        {title}
      </Heading>
      {lead ? (
        <Text type="large" weight="normal" as="div" color="secondary" textWrap="pretty">
          {lead}
        </Text>
      ) : null}
    </VStack>
  );
}

export type Item = {
  title: string;
  body: ReactNode;
  badge?: string;
  badgeVariant?: "success" | "warning" | "info" | "neutral";
};

/** A grid of small cards: a title, a few plain words, an optional status badge. */
export function Cards({ items, min = 280 }: { items: Item[]; min?: number }) {
  return (
    <Grid columns={{ minWidth: min, repeat: "fit" }} gap={4}>
      {items.map((item) => (
        <Card key={item.title} variant="muted" padding={5}>
          <VStack gap={2} hAlign="start">
            {item.badge ? <Badge variant={item.badgeVariant ?? "neutral"} label={item.badge} /> : null}
            <Heading level={3}>{item.title}</Heading>
            <Text as="div" type="large" weight="normal" color="secondary" textWrap="pretty">
              {item.body}
            </Text>
          </VStack>
        </Card>
      ))}
    </Grid>
  );
}

/** A box for a fact only the founder can supply. It is loud on purpose so none is missed. */
export function Placeholder({ what }: { what: string }) {
  return (
    <Card variant="yellow" padding={4}>
      <HStack gap={3} vAlign="center" wrap="wrap">
        <Badge variant="warning" label="To be added by the founder" />
        <Text as="span" type="large" weight="semibold">
          {what}
        </Text>
      </HStack>
    </Card>
  );
}

export function Estimate() {
  return <Badge variant="orange" label="Estimate" />;
}

/** An outside source. Always opens in a new tab. */
export function Src({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} isExternalLink>
      {children}
    </Link>
  );
}

export function Para({ children }: { children: ReactNode }) {
  return (
    <Text as="p" type="large" weight="normal" color="secondary" textWrap="pretty">
      {children}
    </Text>
  );
}
