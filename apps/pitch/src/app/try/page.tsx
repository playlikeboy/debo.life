import type { Metadata } from "next";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "../../components/band";
import { DemoVideo } from "../../components/demo-video";
import { Cards, Intro, Para } from "../../components/parts";
import { Shell } from "../../components/shell";
import { CONTACT_EMAIL, DEMO_EMAIL, DEMO_PASSWORD } from "../../config";
import { APP_URL } from "../../links";
import { TOUCH } from "../../touch";

export const metadata: Metadata = { title: "Try it" };

export default function Try() {
  const hasLogin = DEMO_EMAIL !== "" && DEMO_PASSWORD !== "";
  return (
    <Shell>
      <Band id="try">
        <Intro
          id="try"
          badge="Try it"
          title="Use the app yourself"
          lead="Sign in to the live app with a demo account. It holds only made-up entries, so nothing private is at stake. Please do not add real personal details."
        />
        <Card variant="muted" padding={6}>
          <VStack gap={3} hAlign="start">
            <Heading level={3}>Demo sign-in for my.debo.life</Heading>
            {hasLogin ? (
              <>
                <Text as="p" type="large">
                  Email: {DEMO_EMAIL}
                </Text>
                <Text as="p" type="large">
                  Password: {DEMO_PASSWORD}
                </Text>
              </>
            ) : (
              <Text as="p" type="large" weight="normal" color="secondary">
                Ask us for a demo login.{CONTACT_EMAIL ? ` Write to ${CONTACT_EMAIL}.` : ""}
              </Text>
            )}
            <HStack gap={3} wrap="wrap">
              <Button label="Open my.debo.life" variant="primary" size="lg" href={APP_URL} style={TOUCH} />
            </HStack>
          </VStack>
        </Card>
      </Band>

      <Band id="watch" variant="muted">
        <Intro id="watch" badge="Video" title="The demo video" />
        <DemoVideo />
      </Band>

      <Band id="script">
        <Intro id="script" badge="Five-minute tour" title="What to try, in order" />
        <Cards
          items={[
            { title: "1. Open the Journal", body: "Read the made-up entries, then write one of your own. Edit it, then delete it." },
            { title: "2. Ask a question", body: "Try \"What did I plant on the balcony?\" Press the source chip and see the original entry open." },
            { title: "3. Ask something not in the journal", body: "Debo should say it does not have anything about that yet, instead of guessing." },
            { title: "4. See what Debo knows", body: "Open the memories page. Every memory has its source. Fix one or forget one." },
            { title: "5. Talk to Debo", body: "If voice is switched on for the demo, press Start talking and speak in English, Hindi or a mix. Look for the clear line that says whether the microphone is on." },
            { title: "6. Look at Apps", body: "See how apps are connected one at a time, and that anything that sends or changes asks for a yes first." },
          ]}
        />
        <Para>
          The app is an early version. Some features need services that may not be switched on for the demo, and the page will say so
          where that is the case.
        </Para>
      </Band>
    </Shell>
  );
}
