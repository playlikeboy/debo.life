import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://about.debo.life/", changeFrequency: "monthly", priority: 1 }];
}
