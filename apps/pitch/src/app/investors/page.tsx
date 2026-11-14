import type { Metadata } from "next";
import { Banner } from "@astryxdesign/core/Banner";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "../../components/band";
import { Intro, Para, Src } from "../../components/parts";
import { Shell } from "../../components/shell";
import { ACCELERATORS, ANGELS, CHECKED_ON, CREDITS, FUNDS, type Target } from "../../content/investors";

export const metadata: Metadata = { title: "Investors to approach" };

function Group({ id, title, items }: { id: string; title: string; items: Target[] }) {
  return (
    <VStack gap={4}>
      <Heading level={3} id={id}>
        {title}
      </Heading>
      <Grid columns={{ minWidth: 300, repeat: "fit" }} gap={4} align="start">
        {items.map((t) => (
          <Card key={t.name} variant="muted" padding={5}>
            <VStack gap={2} hAlign="start">
              <Badge variant="neutral" label={t.kind} />
              <Heading level={4}>{t.name}</Heading>
              <Text as="p" type="supporting" color="secondary">
                Stage: {t.stage}
              </Text>
              <Text as="p" type="supporting" color="secondary">
                Cheque: {t.cheque}
              </Text>
              <Para>{t.fit}</Para>
              <Src href={t.href}>{t.hrefLabel}</Src>
              {t.evidence ? <Src href={t.evidence.href}>{t.evidence.label}</Src> : null}
            </VStack>
          </Card>
        ))}
      </Grid>
    </VStack>
  );
}

export default function Investors() {
  return (
    <Shell>
      <Band id="targets">
        <Banner
          status="warning"
          title="A target list, not current investors"
          description="These are funds, programs and networks Debo plans to approach. None has invested in Debo, spoken with us or endorsed it. Only public pages are linked. No private contact details."
        />
        <Intro
          id="targets"
          badge="Investors to approach"
          title="Who plausibly backs early consumer AI in India"
          lead={`Researched on ${CHECKED_ON} from each investor's own page where we could read it, and from press or third-party summaries where marked. Cheque sizes are shown only when a public page states them. Check each before applying: programs open and close, and funds change focus.`}
        />
        <Group id="funds" title="Funds" items={FUNDS} />
        <Group id="accelerators" title="Accelerators and programs" items={ACCELERATORS} />
        <Group id="angels" title="Angel networks" items={ANGELS} />
        <Group id="credits" title="Credits that stretch the budget" items={CREDITS} />
        <Para>
          Order of approach we suggest: first the programs with a public application (Surge, India Quotient, Antler, YC), then angel
          networks for a small first cheque, then funds that lead later rounds once there is real usage.
        </Para>
      </Band>
    </Shell>
  );
}
