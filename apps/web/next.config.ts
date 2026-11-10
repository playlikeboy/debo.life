import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The landing page has no server code, so it builds to plain files in `out/`
  // and is served by Cloudflare as static assets. See docs/DECISIONS.md.
  output: "export",
};

export default config;
