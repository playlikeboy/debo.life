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
      <a href="/" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        Back to Debo
      </a>

      <h1 className="h-section mt-8">How Debo handles your data</h1>
      <p className="mt-4 text-[1.125rem] text-ink-soft">Last updated 14 November 2026.</p>

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
              Your chats with Debo: each question you ask in the chat and Debo&rsquo;s reply, with links to the entries
              it used, so you can come back to a chat later. They stay until you delete the chat or your account.
            </>,
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
        <p>
          When you talk to Debo out loud, your voice goes to LiveKit (LiveKit, Inc.), which carries the call. LiveKit
          turns your speech into text with Deepgram and turns Debo&rsquo;s answer into speech with Cartesia. Only the
          text of your question reaches Debo&rsquo;s answer pipeline, the same as typing it. Debo does not record your
          voice.
        </p>
        <p>
          In the new app, a call works like chat. What you say, as text, goes to the same assistant that answers in
          chat, so it can use your journal, your tasks and the apps you connected, and the AI that writes the answer
          (Anthropic) receives it as it does for a typed question. Each call is saved as a chat that you can read and
          delete in Chat. Anything that sends, posts, creates, changes or deletes still waits for your yes on screen.
          If you ask Debo to act as someone, for example a friend, the role you asked for is saved with your account
          so she keeps it next time. You can see it, change it or stop it in the Apps screen, under &ldquo;A role for Debo&rdquo;, and it is removed when you
          delete your account.
        </p>
        <p>
          We have not yet checked LiveKit&rsquo;s, Deepgram&rsquo;s or Cartesia&rsquo;s terms on training AI and on how
          long they keep audio. Until we do, assume they may keep it for a time. If that worries you, type instead.
        </p>
        <p className="text-ink-soft">
          We checked Anthropic&rsquo;s, Neon&rsquo;s and Databricks&rsquo; terms on 10 November 2026.
        </p>
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
            <>Sign-in emails (codes and links) are sent from mail.debo.life through Cloudflare&rsquo;s email service. Cloudflare sees your email address and the code or link, never your entries.</>,
            <>Mem0&rsquo;s privacy policy does not say how long it keeps data after it is deleted.</>,
          ]}
        />
      </Section>

      <Section id="control" title="What you control today">
        <List
          items={[
            <>Delete any entry. It is deleted right away, and the memories from it a few seconds later.</>,
            <>Delete any chat from the chat page. It and every message in it are deleted right away.</>,
            <>See every memory on the &ldquo;What Debo knows&rdquo; page, with the entry it came from. Fix it or forget it there.</>,
            <>
              Download everything from your home page. You get a zip with every entry and every chat as a plain text
              file and your activity record as a spreadsheet. It opens without Debo.
            </>,
            <>
              Delete your account from your home page. That deletes your memories in Mem0, your account, every entry,
              every piece, every chat and any files, right away.
            </>,
          ]}
        />
      </Section>

      <Section id="new-app" title="The new Debo app (early version)">
        <p>
          A new version of Debo is being tried at my.debo.life. You sign in with the same account, and it reads and
          writes the same journal entries and memories described on this page, with the same companies involved.
        </p>
        <List
          items={[
            <>Chats, tasks and settings you make in the new app are stored in the same Neon database, kept apart from the older app&rsquo;s chats.</>,
            <>
              The new app runs on Cloudflare, like this website. Your unsaved draft stays on your device (in the browser, or
              in a small file in the phone app) until you save it.
            </>,
            <>
              &ldquo;Delete my data&rdquo; in the new app deletes your journal entries, your memories and everything you made
              in the new app. It does not yet delete your account itself or your chats from this website. To delete
              everything, use &ldquo;Delete my account&rdquo; on your home page here.
            </>,
            <>
              &ldquo;Download my data&rdquo; in the new app gives you one file with your entries, memories and what you made
              there. For each voice note or video it lists the details and the words, and a link that downloads the
              recording itself. That link works for 24 hours, so keep the file private.
            </>,
          ]}
        />
        <h3 className="mt-6 font-semibold">Voice notes, videos and speaking into the text</h3>
        <p>Once it is switched on, the new app lets you record a voice note or video, add a recording you already have, or speak into the text box. If you do not see these buttons, it is not on yet and none of the below applies.</p>
        <List
          items={[
            <>
              The recording is stored in Cloudflare R2, in a private bucket with no public address. Only Debo&rsquo;s
              server can reach it. Your phone or browser sends it straight to that bucket. When you play it, Debo gives
              you a link that stops working after an hour, and only you can get one.
            </>,
            <>
              The words are written by Cloudflare Workers AI (a speech model called Whisper), so Cloudflare hears your
              audio. Only the sound is sent, not the picture. Cloudflare says it does not use content processed by
              Workers AI to train AI models, and does not keep it after the request is done. No other company hears your
              recordings.
            </>,
            <>
              The words are saved as an entry, so they are searched, used to answer your questions and sent to Mem0 and
              Anthropic exactly like a written entry, as described above. Answers that use them say &ldquo;Voice
              note&rdquo; or &ldquo;Video&rdquo; and the date.
            </>,
            <>
              While the words are written, a temporary copy of the sound sits on Debo&rsquo;s server. It is deleted when
              that work ends. The recording itself is kept until you delete it.
            </>,
            <>
              When you press &ldquo;Speak&rdquo;, short clips of your voice go to Debo&rsquo;s server and on to the same
              Cloudflare service. The clips are not saved. The microphone is on only while the screen says
              &ldquo;Listening&rdquo; or &ldquo;Recording&rdquo;.
            </>,
            <>
              Debo keeps, with each recording: its type, size, length, when you recorded it, the file name if you added a
              file, the words with their timing, the language, and a fingerprint of the file so the same file is not
              written out twice. It never keeps where you were.
            </>,
            <>
              To delete a recording, delete its entry: the file is removed from storage first, then the entry and what Debo
              learned from it. &ldquo;Delete my data&rdquo; removes every recording you have. A recording you started to
              add but never finished is removed within a day. We have not checked whether Cloudflare keeps any backup
              copy of a deleted file.
            </>,
            <>A recording can be up to 200 MB and 60 minutes. You can add up to 4 hours and 40 recordings a day.</>,
          ]}
        />
      </Section>

      <Section id="connected-apps" title="Connecting your apps (new app, optional)">
        <p>
          In the new app you can connect other apps, such as Gmail, Slack or Notion, so Debo can look things up in them
          and, when you say yes, make changes. This is off until you connect an app, and you choose each one.
        </p>
        <List
          items={[
            <>
              Composio (Sampark Inc, doing business as Composio) holds your sign-in to each app you connect and carries
              each request between Debo and that app. You sign in on the app&rsquo;s own page. Debo never sees your
              password.
            </>,
            <>
              What Debo sends Composio: your Debo account id, so it knows whose connection to use; which app you chose;
              and each request, such as the words to search for, or the text of a message you approved. What comes back
              is shown to you, and the parts needed are sent to the AI that writes Debo&rsquo;s answer (Anthropic).
            </>,
            <>
              Debo only looks things up on its own. Anything that sends, posts, creates, changes or deletes waits for
              your yes on screen. Voice can never give that yes.
            </>,
            <>
              Debo&rsquo;s own logs keep which app and tool were used and whether it worked, never your messages or
              results.
            </>,
            <>
              Composio&rsquo;s privacy policy says it keeps the inputs and results of requests in its logs and deletes
              them automatically one year after the request, and that it does not use them to train AI. We checked its
              policy on 14 November 2026.
            </>,
            <>
              To disconnect an app, use &ldquo;Disconnect&rdquo; on the Apps screen. That deletes the connection at
              Composio. &ldquo;Delete my data&rdquo; in the new app disconnects every app you connected. The new app
              does not hold your app passwords or tokens, so &ldquo;Download my data&rdquo; lists which apps you
              connected and when, and nothing more.
            </>,
          ]}
        />
      </Section>

      <Section id="cookies" title="Cookies and your browser">
        <p>Debo only uses the sign-in cookies it needs to keep you signed in. No ads, no tracking, no analytics.</p>
        <p>
          While you write a journal entry, Debo keeps your unsaved draft only in this browser, so you don&rsquo;t lose
          it if the page closes. It is not sent to Debo until you save it. Saving, signing out or deleting your
          account removes the draft from the browser.
        </p>
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
