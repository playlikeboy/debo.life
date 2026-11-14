import { VStack } from "@astryxdesign/core/Layout";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "./band";

export const QUESTIONS = [
  {
    q: "Is Debo finished?",
    a: "No. Debo is an early version. Accounts, the journal, asking about your life, memories, and talking out loud work today. Connecting your apps and voice and video journals are still being built.",
  },
  {
    q: "Is it free?",
    a: "You can start for free. Each person has a daily limit on questions, so no one account can run up a big bill. Plans are not set yet, and we will tell you before anything costs money.",
  },
  {
    q: "Does Debo make things up?",
    a: "Debo answers only from what you have written, and shows the entry it used. When it finds nothing, it says it does not know instead of guessing.",
  },
  {
    q: "Can I use Debo in Hindi?",
    a: "You can talk to Debo out loud in English or Hindi.",
  },
  {
    q: "Who can read my entries?",
    a: "You can. Debo’s servers also read them so they can search and answer. To answer a question, the matching pieces go to an AI company that writes the reply. The privacy page lists each company and what it does.",
  },
  {
    q: "How do I get my data out, or delete it?",
    a: "You can download your data from the app, and delete any entry or memory. The privacy page explains exactly what each delete button removes.",
  },
  {
    q: "Will Debo do things without asking?",
    a: "No. When Debo starts doing tasks, it will ask for a clear yes before it sends, posts, pays, deletes or changes anything outside Debo.",
  },
];

export function Faq() {
  return (
    <Band id="faq" variant="muted">
      <VStack gap={6} width="100%" maxWidth={760}>
        <Heading level={2} type="display-2" weight="bold" id="faq-title" textWrap="balance">
          Questions people ask
        </Heading>
        <CollapsibleGroup type="single" hasDividers>
          {QUESTIONS.map((item, index) => (
            <Collapsible
              key={item.q}
              value={`q${index}`}
              trigger={
                <VStack paddingBlock={2}>
                  <Text as="span" type="large">
                    {item.q}
                  </Text>
                </VStack>
              }
            >
              <Text as="p" type="large" weight="normal" color="secondary" textWrap="pretty">
                {item.a}
              </Text>
            </Collapsible>
          ))}
        </CollapsibleGroup>
      </VStack>
    </Band>
  );
}
