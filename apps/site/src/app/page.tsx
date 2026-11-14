import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { Apps } from "../components/apps";
import { Ask } from "../components/ask";
import { Closing } from "../components/closing";
import { Faq, QUESTIONS } from "../components/faq";
import { Hero } from "../components/hero";
import { Knows } from "../components/knows";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { Trust } from "../components/trust";
import { WriteOrSay } from "../components/write-or-say";

// Structured data for search engines. It says what Debo is and nothing more:
// no ratings, no prices, no counts, because none exist yet.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Debo",
      url: "https://about.debo.life",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      description:
        "A friendly assistant that remembers your life. Write a journal or talk out loud, then ask about your own past and plans. Every answer shows its source.",
      image: "https://about.debo.life/og.png",
    },
    {
      "@type": "FAQPage",
      mainEntity: QUESTIONS.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <Layout
        height="auto"
        header={<SiteHeader />}
        content={
          <LayoutContent role="main" label="Debo" isScrollable={false} padding={0}>
            <Hero />
            <WriteOrSay />
            <Ask />
            <Knows />
            <Apps />
            <Trust />
            <Faq />
            <Closing />
          </LayoutContent>
        }
        footer={<SiteFooter />}
      />
    </>
  );
}
