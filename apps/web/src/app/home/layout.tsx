import { HomeNav } from "@/components/home-nav";

/** Every signed-in page shares this header: a skip link, then the same links to each part of Debo. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-full focus:border-2 focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>
      <header className="wrap max-w-[48rem] pt-6">
        <HomeNav />
      </header>
      <div id="content" tabIndex={-1} className="outline-none">
        {children}
      </div>
    </>
  );
}
