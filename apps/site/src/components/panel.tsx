import type { ReactNode } from "react";
import { Section, VStack } from "@astryxdesign/core/Layout";
import type { SectionVariant } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";

type PanelProps = {
  id: string;
  title: string;
  intro?: string;
  variant?: SectionVariant;
  children: ReactNode;
};

// One landing section: a labelled region with a heading, a short intro and content.
export function Panel({ id, title, intro, variant = "section", children }: PanelProps) {
  return (
    <Section variant={variant} padding={6} role="region" aria-labelledby={`${id}-title`} id={id}>
      <VStack gap={6}>
        <VStack gap={2}>
          <Heading level={2} id={`${id}-title`} textWrap="balance">
            {title}
          </Heading>
          {intro ? (
            <Text type="large" as="p" color="secondary">
              {intro}
            </Text>
          ) : null}
        </VStack>
        {children}
      </VStack>
    </Section>
  );
}
