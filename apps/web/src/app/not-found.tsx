import { Debo } from "@/components/debo";

export default function NotFound() {
  return (
    <main className="wrap grid min-h-dvh place-items-center py-16">
      <div className="max-w-[34rem] text-center">
        <Debo className="mx-auto block w-40" />
        <h1 className="h-section mt-6">There is no page here</h1>
        <p className="mt-4 text-[1.125rem] text-ink-soft">
          The link may be old or have a typo. The home page has everything about Debo.
        </p>
        <a href="/" className="btn btn-primary mt-8">
          Go to the home page
        </a>
      </div>
    </main>
  );
}
