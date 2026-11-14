import type { MetadataRoute } from "next";

// This site is for investors. Ask every crawler to stay out.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
