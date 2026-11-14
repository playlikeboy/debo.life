import type { Metadata } from "next";
import { Band } from "../../components/band";
import { Cards, Estimate, Intro, Para, Placeholder, Src } from "../../components/parts";
import { Shell } from "../../components/shell";
import { BUDGETS, CHECKED, FIXED_TOTAL, peopleFor, usd } from "../../content/economics";

export const metadata: Metadata = { title: "Go to market and growth plan" };

export default function GoToMarket() {
  return (
    <Shell>
      <Band id="constraint">
        <Intro
          id="constraint"
          badge="Go to market"
          title="We cannot open the doors before we can pay for the guests"
          lead="Every active person costs real money in AI, voice and browser time. A free public launch would turn every new user into a bill. So the plan grows people only as fast as the money allows, and funding is what lets it speed up."
        />
        <Cards
          items={[
            { title: "What costs money per person", body: "Chat answers, speaking with Debo (the biggest cost), writing out recordings, storing them, browser time and connected-app calls. The unit economics page shows each one with its price and source." },
            { title: "What we do about it", body: "Invite-only waitlist, hard limits per person, a small paid founding group, and a rule that we open a wave only when the monthly bill for it is already covered." },
            { title: "What this is not", body: "It is not a hype launch, and it will not give us a big user number early. We think that trade is right for a product that holds people's private lives." },
          ]}
        />
      </Band>

      <Band id="stages" variant="muted">
        <Intro
          id="stages"
          badge="Stages"
          title="Four stages, each opened by money or by evidence"
          lead={
            <>
              How many people each stage can carry comes from the formulas on the unit economics page. <Estimate />{" "}
              All head counts are estimates for a &ldquo;typical&rdquo; person, and the cost of the platform itself is about{" "}
              {usd(FIXED_TOTAL)} a month before the first person.
            </>
          }
        />
        <Cards
          min={300}
          items={[
            {
              title: "Stage 0. Before funding: a waitlist and a few invited people",
              badge: "Now",
              badgeVariant: "info",
              body: (
                <>
                  A public waitlist page (it records only an email address, with a plain note on how it is kept). The founder invites people in
                  groups of 10 to 25, by hand, from people he knows and the waitlist. Text and voice notes first; voice calls
                  and browser only for a few. At a self-funded monthly budget of {usd(BUDGETS[0])}, about{" "}
                  {peopleFor(BUDGETS[0])} typical people. At {usd(BUDGETS[1])}, about {peopleFor(BUDGETS[1])}.
                </>
              ),
            },
            {
              title: "Stage 1. Founding cohort: a small group that pays",
              badge: "Planned",
              badgeVariant: "warning",
              body: "People from stage 0 who want voice and the browser are asked to pay a founding price (proposal: $6 a month) for a fixed set of limits. This tests whether anyone pays, and whether the cost per person is what we estimated. It needs the payment set-up on the roadmap.",
            },
            {
              title: "Stage 2. After pre-seed money: waves of a few hundred",
              badge: "Planned",
              badgeVariant: "warning",
              body: (
                <>
                  With a monthly AI budget of {usd(BUDGETS[2])}, about {peopleFor(BUDGETS[2])} typical people can be carried at once. We open a wave only
                  when the last one is stable, measured by the numbers below. Hindi and Hinglish voice is tested with real
                  speakers before it is promoted.
                </>
              ),
            },
            {
              title: "Stage 3. Open sign-up, with limits",
              badge: "Planned",
              badgeVariant: "warning",
              body: "Only when cost per active person has been measured for at least a quarter, plans cover it with margin, and the full privacy policy (checked by someone qualified) is published. Free users keep strict caps. A paid plan unlocks voice and browser.",
            },
          ]}
        />
        <Placeholder what="Waitlist link and how many people are on it (leave out if none)" />
      </Band>

      <Band id="controls">
        <Intro
          id="controls"
          badge="Cost controls"
          title="Limits that already exist, and limits still to add"
        />
        <Cards
          items={[
            { title: "Daily AI limit per person", badge: "Built", badgeVariant: "success", body: "Each person has a daily token limit on our AI key (default 40,000 tokens, resets at midnight UTC). The person gets a plain message when they reach it." },
            { title: "Recording limits", badge: "Built", badgeVariant: "success", body: "200 MB and 60 minutes per recording; 40 recordings and 4 hours a day. Dictation is limited to 30 clips a minute and 600 a day." },
            { title: "Spending caps with each provider", badge: "To do", badgeVariant: "warning", body: "Set a monthly cap with Anthropic, LiveKit, Cloudflare and Mem0, so a bug or abuse cannot run past the budget." },
            { title: "Voice minutes counted per person", badge: "To do", badgeVariant: "warning", body: "Voice is the biggest cost and today only LiveKit's dashboard counts the minutes. Debo's own limit counts answer tokens only. Counting minutes per person is on the voice to-do list." },
            { title: "Invitation only", badge: "To do", badgeVariant: "warning", body: "Sign-up is open to anyone today. An invite code or allow-list must gate it before we tell anyone about the product." },
            { title: "Browser stays one shared container", badge: "Note", badgeVariant: "neutral", body: "The browser runs as one shared container for now. Per-person isolation is future work, so it is limited to a few trusted people." },
          ]}
        />
      </Band>

      <Band id="channels" variant="muted">
        <Intro
          id="channels"
          badge="Growth plan"
          title="How people find Debo once we can afford them"
          lead="These are plans, in the order we would try them. None has been run yet."
        />
        <Cards
          items={[
            { title: "1. Founder-led and by hand", body: "Personal invitations to people who already journal or send themselves voice notes. Watch them use it, fix what confuses them. Cheapest and most useful early." },
            { title: "2. Referral invitations", body: "Each person who has used Debo for two weeks gets two invitations. People arrive in pairs, with someone to ask for help, and growth is limited by the number of invitations we choose to issue." },
            { title: "3. Communities", body: "Journaling, student and productivity communities, and Hindi-speaking communities for the voice story. Short real demos, not ads." },
            { title: "4. Family set-up", body: "One person sets Debo up for a parent. The elderly-parent story is a natural source of a second user per household." },
            { title: "5. Partnerships and credits", body: (<>Startup programs may offer cloud and AI credits that stretch the pre-funding budget: <Src href="https://www.cloudflare.com/forstartups/">Cloudflare for Startups</Src>, <Src href="https://www.anthropic.com/startups">Anthropic startups</Src>, <Src href="https://startup.google.com/programs/accelerator/india/">Google for Startups Accelerator India</Src>. We have not applied, and have not checked eligibility.</>) },
            { title: "6. Later: paid reach", body: "Paid ads only after the unit economics are measured, and only for a plan that pays back its own cost." },
          ]}
        />
      </Band>

      <Band id="metrics">
        <Intro id="metrics" badge="What we measure" title="Goals that tell us when to open the next wave" lead="These are goals from the product notes, not results. There are no users yet." />
        <Cards
          items={[
            { title: "Activation", body: "A new person saves three things and gets one useful answer in their first ten minutes." },
            { title: "Trust", body: "People press the source chips. That means they check, and trust grows." },
            { title: "Retention", body: "People come back in week two without a reminder." },
            { title: "Cost per active person", body: "Measured monthly against the table on the unit economics page, by feature." },
            { title: "Paid conversion", body: "Share of invited people who take the founding plan. We do not set a target before we see the first cohort." },
          ]}
        />
        <Para>
          Payments: not every payment company takes new Indian businesses for international subscriptions (from the
          repository's plans notes). Options to check before building: a merchant of record (Paddle, Polar, Dodo Payments), Razorpay for India, or
          Stripe if available. Prices are as of {CHECKED}; nothing here is decided.
        </Para>
      </Band>
    </Shell>
  );
}
