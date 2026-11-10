import { Debo } from "@/components/debo";
import { DeboArt } from "@/components/debo-art";
import { MemoryDemo } from "@/components/memory-demo";

const REPO = "https://github.com/playlikeboy/debo.life";

const GIVE = [
  { name: "Write", text: "Keep a journal. A line or a page, whenever you like." },
  { name: "Talk", text: "Record a voice note. Debo will turn it into words and keep both." },
  { name: "Papers", text: "Add a bill, a letter or a report. Debo will read it for you." },
  { name: "Photos", text: "Add a photo. Debo will note what is in it and any words on it." },
];

const PROMISES = [
  {
    title: "Your data is yours",
    text: "We will not sell it, share it or show ads against it.",
  },
  {
    title: "No AI training on your life",
    text: "Not by us, and we will pick AI providers who agree to the same.",
  },
  {
    title: "Debo shows its sources",
    text: "Every answer links to the entry, recording or file it came from. No source, no answer.",
  },
  {
    title: "You can fix or forget anything",
    text: "See every memory. Correct it or remove it. Forgetting really deletes it.",
  },
  {
    title: "You can leave with everything",
    text: "Download all of it in open formats, or delete your account and all of it goes.",
  },
  {
    title: "Debo asks first",
    text: "Before reading from a new app or doing anything outside Debo, it asks you.",
  },
  {
    title: "Nothing happens in secret",
    text: "Debo keeps a plain list of everything it read and did. You can read all of it.",
  },
];

const QUESTIONS = [
  {
    q: "Can I use Debo today?",
    a: "Not yet. Debo is being built and is not open. There is no launch date, and we would rather say that than guess. You can follow the work on GitHub.",
  },
  {
    q: "Who will be able to read my notes?",
    a: "To answer you, Debo will send the pieces of your notes that matter to an AI company, and we will tell you which one. Debo's own servers will also need to read your notes to search them, so they will not be locked in a way only you can open. We would rather tell you that now than hide it.",
  },
  {
    q: "Will Debo give me medical, legal or money advice?",
    a: "No. Debo can tell you what your own notes say, like what the doctor told you in March. It will not tell you what to do about it.",
  },
  {
    q: "Is Debo a person?",
    a: "No. Debo is an AI assistant with a friendly face. It will never pretend to be a person.",
  },
];

const STEPS = [
  { title: "Save and ask", text: "Journal, voice notes, papers and photos. Ask about them and get answers with sources." },
  { title: "See what Debo knows", text: "One page with every memory, where you can fix or forget each one." },
  { title: "Talk to Debo", text: "Ask out loud and hear Debo answer." },
  { title: "Connect your apps", text: "Bring in your calendar and notes, and let other AI tools use your memories, only if you say so." },
  { title: "Plans", text: "Use your own AI key for free, or pay monthly and use ours." },
];

export default function Home() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      <header className="wrap flex items-center justify-between py-5">
        <a href="/" className="flex items-center gap-2 font-display text-[1.375rem] font-bold no-underline">
          <Mark />
          Debo
        </a>
        <nav aria-label="Main" className="flex items-center gap-6">
          <ul className="hidden items-center gap-6 font-semibold md:flex">
            <li>
              <a href="#promises" className="underline-offset-4 hover:underline">
                Promises
              </a>
            </li>
            <li>
              <a href="#plans" className="underline-offset-4 hover:underline">
                Plans
              </a>
            </li>
            <li>
              <a href="#questions" className="underline-offset-4 hover:underline">
                Questions
              </a>
            </li>
          </ul>
          <a href={REPO} className="btn btn-quiet">
            See the code
          </a>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="wrap grid items-center gap-10 pb-16 pt-6 md:grid-cols-[1.1fr_0.9fr] md:gap-8 md:pb-24 md:pt-12">
          <div>
            <p className="chip">Being built. Not open yet.</p>
            <h1 className="h-hero mt-5">
              Hi, I&rsquo;m Debo. I&rsquo;ll remember your life, so you can stop trying to.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.125rem] text-ink-soft md:text-[1.25rem]">
              Give me your journals, voice notes, papers and photos. Ask me anything about them. I will always
              show you where my answer came from.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href={REPO} className="btn btn-primary">
                Follow the build on GitHub
              </a>
              <a href="#promises" className="btn btn-quiet">
                Read our promises
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[26rem]">
            <Debo className="relative z-10 mx-auto -mb-10 block w-[52%] md:w-[58%]" />
            <figure
              className="rounded-[24px] border-2 border-ink bg-paper p-5 pt-12 md:p-6 md:pt-14"
              style={{ boxShadow: "var(--shadow-hard)" }}
            >
              <p className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-[4px] bg-ink px-4 py-2 text-paper">
                When did Riya move to Pune?
              </p>
              <p className="mt-4 max-w-[92%] text-[1.125rem] font-semibold">
                In March. You wrote about helping her pack up her books.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Where this answer came from">
                <li className="chip">Journal, 14 March</li>
                <li className="chip">Voice note, 16 March</li>
              </ul>
              <figcaption className="mt-5 border-t border-line pt-3 text-ink-soft">
                An example of how Debo will answer. The names are made up.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Give Debo anything */}
        <section className="border-y-2 border-ink bg-paper">
          <div className="wrap py-16 md:py-24">
            <h2 className="h-section max-w-[18ch]">Give Debo the bits of your life, in any form</h2>
            <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {GIVE.map((item) => (
                <div key={item.name} className="border-t-2 border-ink pt-4">
                  <dt className="font-display text-[1.375rem] font-bold">{item.name}</dt>
                  <dd className="mt-2 text-ink-soft">{item.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* You can always check */}
        <section className="wrap grid gap-10 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-14 md:py-24">
          <div>
            <h2 className="h-section">Nothing is hidden from you</h2>
            <p className="mt-5 max-w-[30rem] text-[1.125rem] text-ink-soft">
              Most assistants keep what they know about you out of sight. Debo will show you all of it on one
              page, with where each thing came from.
            </p>
            <p className="mt-4 max-w-[30rem] text-[1.125rem] text-ink-soft">
              If something is wrong, fix it. If you want it gone, forget it. Try it here.
            </p>
          </div>
          <MemoryDemo />
        </section>

        {/* Promises */}
        <section id="promises" className="scroll-mt-6 bg-ink text-paper">
          <div className="wrap py-16 md:py-24">
            <h2 className="h-section max-w-[20ch]">Seven promises we are building Debo around</h2>
            <p className="mt-5 max-w-[38rem] text-[1.125rem] text-line">
              Debo is not open yet, so these are not claims about a product you can use today. They are the
              rules it is being built by, written down so you can hold us to them.
            </p>
            <ul className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
              {PROMISES.map((promise) => (
                <li key={promise.title} className="border-t border-ink-soft pt-5">
                  <h3 className="text-[1.375rem] text-mint">{promise.title}</h3>
                  <p className="mt-2 max-w-[34rem] text-line">{promise.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-10 max-w-[38rem] text-line">
              One honest limit: to answer you, Debo has to send the relevant pieces of your notes to an AI
              model. We will always tell you which company runs it.{" "}
              <a
                href={`${REPO}/blob/main/docs/PRIVACY-AND-TRUST.md`}
                className="font-semibold text-paper underline underline-offset-4"
              >
                Read the full privacy plan
              </a>
              .
            </p>
          </div>
        </section>

        {/* Build order: a real sequence, so it is numbered */}
        <section className="wrap py-16 md:py-24">
          <h2 className="h-section">What we are building, in order</h2>
          <ol className="mt-10 grid gap-0">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="grid grid-cols-[3rem_1fr] gap-x-4 border-t-2 border-ink py-5 md:grid-cols-[4rem_16rem_1fr] md:items-baseline"
              >
                <span className="font-display text-[1.75rem] font-bold leading-none" aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className="text-[1.375rem]">{step.title}</h3>
                <p className="col-start-2 mt-1 text-ink-soft md:col-start-3 md:mt-0">{step.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-ink-soft">
            We are just starting step one. There are no dates yet, and we would rather say that than guess.
          </p>
        </section>

        {/* Two ways to use it */}
        <section id="plans" className="scroll-mt-6 border-t-2 border-ink bg-paper">
          <div className="wrap py-16 md:py-24">
            <h2 className="h-section">Two ways you will be able to use Debo</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-[24px] border-2 border-ink bg-sky p-6 md:p-8">
                <h3 className="text-[1.75rem]">Your own key</h3>
                <p className="mt-1 font-semibold">Free</p>
                <p className="mt-4 text-ink-soft">
                  If you already pay an AI company, paste your key into Debo. You pay them for what you use.
                  We will store your key encrypted, and you can remove it any time.
                </p>
              </div>
              <div className="rounded-[24px] border-2 border-ink bg-sky p-6 md:p-8">
                <h3 className="text-[1.75rem]">A monthly plan</h3>
                <p className="mt-1 font-semibold">Price not decided yet</p>
                <p className="mt-4 text-ink-soft">
                  No key needed. One monthly price that covers the AI, voice and connected apps. You will see
                  the price and how to cancel before you pay.
                </p>
              </div>
            </div>
            <p className="mt-6 max-w-[40rem] text-ink-soft">
              Seeing, fixing, exporting and deleting your own data will be free on both. Always.
            </p>
          </div>
        </section>

        {/* Plain answers to the questions people ask first */}
        <section id="questions" className="scroll-mt-6 border-t-2 border-ink">
          <div className="wrap py-16 md:py-24">
            <h2 className="h-section">Questions you might have</h2>
            <div className="mt-10 max-w-[48rem] border-b-2 border-ink">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="faq border-t-2 border-ink">
                  <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-4 text-[1.375rem] font-display font-bold">
                    {item.q}
                    <span className="faq-mark shrink-0" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="max-w-[40rem] pb-5 text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink">
        <div className="wrap flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-display text-[1.375rem] font-bold">
            <Mark />
            Debo
          </p>
          <p className="text-ink-soft">Being built in the open by one person.</p>
          <a href={REPO} className="font-semibold underline underline-offset-4">
            GitHub
          </a>
        </div>
      </footer>
    </>
  );
}

function Mark() {
  return <DeboArt width={36} height={36} ground={false} blink={false} />;
}
