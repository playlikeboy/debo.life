import type { Metadata } from "next";
import { VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Heading, Text } from "@astryxdesign/core/Text";
import { Band } from "../../components/band";
import { Estimate, Intro, Para, Placeholder, Src } from "../../components/parts";
import { Shell } from "../../components/shell";
import {
  BUDGETS,
  CHECKED,
  costLines,
  FIXED,
  FIXED_TOTAL,
  MEM0_PLACEHOLDER_PER_USER,
  peopleFor,
  PRICES,
  PROFILES,
  TIERS,
  TOKENS_IN_PER_QUESTION,
  TOKENS_OUT_PER_QUESTION,
  total,
  usd,
} from "../../content/economics";

export const metadata: Metadata = { title: "Unit economics" };

export default function Economics() {
  return (
    <Shell>
      <Band id="prices">
        <Intro
          id="prices"
          badge="Unit economics"
          title="What one person costs us each month"
          lead={`Section 1 lists the public prices we looked up on ${CHECKED}, each with its link. Sections 2 to 4 turn them into cost per person, using usage guesses that are ours. The numbers live in one file (apps/pitch/src/content/economics.ts) so they can be changed.`}
        />
        <Heading level={3}>1. Public prices, checked {CHECKED}</Heading>
        <Grid columns={{ minWidth: 300, repeat: "fit" }} gap={4}>
          {PRICES.map((price) => (
            <Card key={price.id} variant="muted" padding={5}>
              <VStack gap={2} hAlign="start">
                <Text as="p" type="large" weight="semibold">
                  {price.what}
                </Text>
                <Text as="p" type="large">
                  {price.text} {price.unit}
                </Text>
                {price.note ? (
                  <Text as="p" type="supporting" color="secondary">
                    {price.note}
                  </Text>
                ) : null}
                <Src href={price.source}>Source, read {CHECKED}</Src>
              </VStack>
            </Card>
          ))}
        </Grid>
        <Para>
          Not found: a price for the text-to-numbers service (embeddings) behind Neon&rsquo;s AI gateway, and any Mem0 rate beyond
          its free allowance. Neither is in the totals below, except the Mem0 placeholder.
        </Para>
      </Band>

      <Band id="usage" variant="muted">
        <Intro
          id="usage"
          badge="Estimates"
          title="2. Cost per person by feature"
          lead={
            <>
              <Estimate /> Usage is our guess for three kinds of person. A chat question is assumed to use{" "}
              {TOKENS_IN_PER_QUESTION.toLocaleString()} input and {TOKENS_OUT_PER_QUESTION} output tokens, because the matching pieces of entries
              go in with the question. These will be replaced with measured numbers from the invited group. Payment fees and
              taxes are not included.
            </>
          }
        />
        <Grid columns={{ minWidth: 320, repeat: "fit" }} gap={5} align="start">
          {PROFILES.map((profile) => {
            const lines = costLines(profile.usage, profile.billableShare);
            return (
              <Card key={profile.name} padding={5}>
                <VStack gap={3} hAlign="start">
                  <Badge variant="orange" label="Estimate" />
                  <Heading level={3}>{profile.name} person</Heading>
                  <Text as="p" type="supporting" color="secondary">
                    {profile.story} Each month: {profile.usage.questions} questions, {profile.usage.voiceMinutes} voice minutes,{" "}
                    {profile.usage.transcribeMinutes} minutes of recordings written out, {profile.usage.storageGb} GB stored,{" "}
                    {profile.usage.browserHours} browser hours, {profile.usage.toolCalls} app calls.
                  </Text>
                  {lines.map((line) => (
                    <VStack key={line.label} gap={0.5}>
                      <Text as="p" weight="semibold">
                        {line.label}: {usd(line.dollars)}
                      </Text>
                      <Text as="p" type="supporting" color="secondary">
                        {line.formula}
                      </Text>
                    </VStack>
                  ))}
                  <Heading level={3}>About {usd(total(lines))} a month</Heading>
                </VStack>
              </Card>
            );
          })}
        </Grid>
        <Para>
          The memory line is a flat ${MEM0_PLACEHOLDER_PER_USER} per person because Mem0 publishes no rate. Voice dominates every other cost, which is
          why voice minutes are the first thing capped in each plan. Browser time is an upper bound, with CPU at full use for every hour the
          container is awake.
        </Para>
      </Band>

      <Band id="fixed">
        <Intro id="fixed" badge="Estimates" title="3. Costs that do not depend on the number of people" lead={<><Estimate /> The platform bills even with no users. These are upper bounds before included allowances.</>} />
        <Grid columns={{ minWidth: 280, repeat: "fit" }} gap={4}>
          {FIXED.map((item) => (
            <Card key={item.label} variant="muted" padding={5}>
              <VStack gap={1}>
                <Text as="p" type="large" weight="semibold">
                  {item.label}: {usd(item.dollars)} a month
                </Text>
                <Text as="p" type="supporting" color="secondary">
                  {item.formula}
                </Text>
              </VStack>
            </Card>
          ))}
        </Grid>
        <Para>Together about {usd(FIXED_TOTAL)} a month. LiveKit&rsquo;s Ship plan (from $50 a month) is extra if voice goes past 1,000 session minutes a month.</Para>
      </Band>

      <Band id="tiers" variant="muted">
        <Intro
          id="tiers"
          badge="Proposal"
          title="4. Plans priced to cover their own limits"
          lead="Prices are a proposal, not a decision (the repository's plans note says so). Each plan is shown at its full limits, which is the worst case for us. Margin is price minus that cost, before payment fees."
        />
        <Grid columns={{ minWidth: 300, repeat: "fit" }} gap={5} align="start">
          {TIERS.map((tier) => {
            const cost = total(costLines(tier.usage, tier.billableShare));
            const margin = tier.price === 0 ? null : Math.round(((tier.price - cost) / tier.price) * 100);
            return (
              <Card key={tier.name} padding={5}>
                <VStack gap={2} hAlign="start">
                  <Badge variant="warning" label="Proposal" />
                  <Heading level={3}>
                    {tier.name}: {tier.price === 0 ? "free" : `$${tier.price} a month`}
                  </Heading>
                  <Para>{tier.line}</Para>
                  <Text as="p" type="supporting" color="secondary">
                    Limits: {tier.usage.questions} questions, {tier.usage.voiceMinutes} voice minutes, {tier.usage.transcribeMinutes} minutes of recordings,{" "}
                    {tier.usage.storageGb} GB, {tier.usage.browserHours} browser hours, {tier.usage.toolCalls} app calls a month.
                  </Text>
                  <Text as="p" weight="semibold">
                    Cost at full limits: about {usd(cost)}
                  </Text>
                  <Text as="p" weight="semibold">
                    {margin === null ? `We pay about ${usd(cost)} a month per invited person. This is the cost of building a waitlist.` : `Margin: about ${margin}%`}
                  </Text>
                </VStack>
              </Card>
            );
          })}
        </Grid>
      </Band>

      <Band id="budget">
        <Intro
          id="budget"
          badge="Estimates"
          title="5. How many typical people a monthly budget carries"
          lead={`Formula: (monthly budget minus the platform cost of ${usd(FIXED_TOTAL)}) divided by the cost of a typical person, rounded down.`}
        />
        <Grid columns={{ minWidth: 220, repeat: "fit" }} gap={4}>
          {BUDGETS.map((b) => (
            <Card key={b} variant="muted" padding={5}>
              <VStack gap={1}>
                <Heading level={3}>{usd(b)} a month</Heading>
                <Text as="p" type="large">
                  About {peopleFor(b)} typical people
                </Text>
              </VStack>
            </Card>
          ))}
        </Grid>
        <Placeholder what="The monthly AI budget the founder can fund before investment, and any startup credits actually received" />
      </Band>
    </Shell>
  );
}
