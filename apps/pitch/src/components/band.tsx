import type { ReactNode } from "react";
import { Center } from "@astryxdesign/core/Center";
import { Section, VStack } from "@astryxdesign/core/Layout";
import type { SectionVariant } from "@astryxdesign/core/Layout";

type BandProps = {
  /** Names the region: the heading inside must use id={`${id}-title`}. */
  id: string;
  variant?: SectionVariant;
  children: ReactNode;
};

// One full-width band of the page. The Section paints the band, Center puts a
// content column in the middle, and the VStack caps that column's width.
// Spacing only uses Astryx's own scale, so every band has the same rhythm.
export function Band({ id, variant = "transparent", children }: BandProps) {
  return (
    <Section
      variant={variant}
      padding={0}
      paddingBlock={10}
      paddingInline={5}
      role="region"
      aria-labelledby={`${id}-title`}
      id={id}
    >
      <Center axis="horizontal">
        <VStack width="100%" maxWidth={1120} gap={8}>
          {children}
        </VStack>
      </Center>
    </Section>
  );
}
