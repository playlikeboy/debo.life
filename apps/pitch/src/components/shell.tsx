import type { ReactNode } from "react";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// Every page uses the same frame: a header with the menu, the page, a footer.
export function Shell({ children }: { children: ReactNode }) {
  return (
    <Layout
      height="auto"
      header={<SiteHeader />}
      content={
        <LayoutContent role="main" label="Debo investor pitch" isScrollable={false} padding={0}>
          {children}
        </LayoutContent>
      }
      footer={<SiteFooter />}
    />
  );
}
