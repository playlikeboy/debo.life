import { Layout, LayoutContent, Section, VStack } from "@astryxdesign/core/Layout";
import { Agent } from "../components/agent";
import { Faq } from "../components/faq";
import { Hero } from "../components/hero";
import { HowItWorks } from "../components/how-it-works";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { Trust } from "../components/trust";
import { Voice } from "../components/voice";

export default function Home() {
  return (
    // The muted Section paints the page's soft light-grey ground.
    <Section variant="muted" padding={0} minHeight="100vh">
      <Layout
        height="auto"
        contentWidth={1040}
        padding={4}
        header={<SiteHeader />}
        content={
          <LayoutContent role="main" label="Debo" isScrollable={false}>
            <VStack gap={8} paddingBlock={6}>
              <Hero />
              <HowItWorks />
              <Voice />
              <Agent />
              <Trust />
              <Faq />
            </VStack>
          </LayoutContent>
        }
        footer={<SiteFooter />}
      />
    </Section>
  );
}
