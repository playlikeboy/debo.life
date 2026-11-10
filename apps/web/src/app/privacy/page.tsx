import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Debo handles your data",
  description: "What Debo stores, where it lives, who else sees it, and how you delete it. Plain words, true today.",
  alternates: { canonical: "/privacy" },
};

const REPO = "https://github.com/playlikeboy/debo.life";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-12 border-t-2 border-ink pt-8">
      <h2 id={id} className="text-[1.75rem]">
        {title}
      </h2>
      <div className="mt-4 grid max-w-[40rem] gap-4">{children}</div>
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="grid list-disc gap-2 pl-6">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="wrap max-w-[48rem] py-16">
      <a href="/" className="font-semibold underline underline-offset-4">
        Back to Debo
      </a>

      <h1 className="h-section mt-8">How Debo handles your data</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">Last updated 10 November 2026.</p>

      <div className="mt-8 max-w-[40rem] rounded-[24px] border-2 border-ink bg-paper p-6">
        <p>
          This page explains how Debo works today. A full privacy policy, checked by someone qualified, comes
          before Debo opens fully.
        </p>
      </div>

      <Section id="stores" title="What Debo stores">
        <List
          items={[
            <>Your name, email and password. Your password passes through Debo on its way to our sign-in service, which stores only a hashed version. Debo never stores or logs it.</>,
            <>Your journal entries.</>,
            <>Short pieces of each entry, made so Debo can search them.</>,
            <>
              Memories: short facts Debo picks out of your entries, like &ldquo;Riya moved to Pune in March&rdquo;. Each
              one keeps a link to the entry it came from. Mem0 stores these, not our database.
            </>,
            <>A list of what Debo saved, deleted, forgot and answered for you (ids and times, not your words).</>,
            <>How many AI tokens your questions used each day (numbers only, never your words), so we can keep costs fair.</>,
          ]}
        />
      </Section>

      <Section id="where" title="Where it is stored">
        <p>
          Your account, your entries and any files live with Neon, which runs our database, sign-in and file
          storage. Neon keeps them in the United States (Amazon Web Services, us-east-2).
        </p>
        <p>
          Your memories live with Mem0 (Embedchain, Inc., doing business as Mem0). Mem0 says it stores data with
          hosting providers in the United States and other countries.
        </p>
        <p>Cloudflare runs the website. Your data travels between you, Cloudflare and Neon over HTTPS.</p>
      </Section>

      <Section id="who" title="Who else sees pieces of your data">
        <p>
          When you save or change an entry, its text goes to the Neon AI Gateway, whose models are run by
          Databricks, to turn it into numbers that let Debo search by meaning. Your questions go there too, for
          the same reason.
        </p>
        <p>
          When you ask a question, the pieces of your entries that match it go to Anthropic, which writes the
          answer. If Anthropic fails, they go to the Neon AI Gateway instead.
        </p>
        <p>
          Anthropic&rsquo;s business terms say it may not train its AI on what we send it. Anthropic deletes what
          we send within 30 days. It keeps things longer only if its safety checks flag a message as breaking its
          rules (up to 2 years), or if the law says it must.
        </p>
        <p>
          Neon says its AI gateway follows Databricks&rsquo; rules. Databricks says it does not use what paying
          customers send to train any AI. It may keep your text for up to 30 days, only to spot abuse.
        </p>
        <p className="text-ink-soft">We checked these companies&rsquo; terms on 10 November 2026.</p>
        <p>
          When you save or change an entry, its text also goes to Mem0. Mem0 uses AI to pick out the facts worth
          remembering, and stores them as your memories. Mem0 says it uses AI providers such as OpenAI and Anthropic.
        </p>
        <p className="text-ink-soft">
          Mem0&rsquo;s privacy policy says it trains its AI models on data from its free plan users, and not on data
          from its paid plan users. We have not yet confirmed which of these covers Debo&rsquo;s Mem0 account. Until
          we do, assume Mem0 may train on what Debo sends it.
        </p>
        <p>We do not sell your data, share it, or show ads against it. We do not train AI on it ourselves.</p>
      </Section>

      <Section id="limits" title="Honest limits">
        <List
          items={[
            <>Debo is not end-to-end encrypted. Debo&rsquo;s servers have to read your notes to search them.</>,
            <>Our database provider may keep backups for a short time. We will state the exact period before Debo opens fully.</>,
            <>Sign-in emails are sent by Neon&rsquo;s shared mail service for now.</>,
            <>Mem0&rsquo;s privacy policy does not say how long it keeps data after it is deleted.</>,
          ]}
        />
      </Section>

      <Section id="control" title="What you control today">
        <List
          items={[
            <>Delete any entry. It is deleted right away, and the memories from it a few seconds later.</>,
            <>See every memory on the &ldquo;What Debo knows&rdquo; page, with the entry it came from. Fix it or forget it there.</>,
            <>
              Download everything from your home page. You get a zip with every entry as a plain text file and your
              activity record as a spreadsheet. It opens without Debo.
            </>,
            <>
              Delete your account from your home page. That deletes your memories in Mem0, your account, every entry,
              every piece and any files, right away.
            </>,
          ]}
        />
      </Section>

      <Section id="cookies" title="Cookies">
        <p>Debo only uses the sign-in cookies it needs to keep you signed in. No ads, no tracking, no analytics.</p>
      </Section>

      <Section id="questions" title="Questions">
        <p>
          Ask on{" "}
          <a href={`${REPO}/issues`} className="font-semibold underline underline-offset-4">
            Debo&rsquo;s GitHub issues page
          </a>
          . Please do not post anything private there, since it is public.
        </p>
      </Section>
    </main>
  );
}
