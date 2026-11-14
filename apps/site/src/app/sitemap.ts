import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://debo.life/", changeFrequency: "monthly", priority: 1 }];
}
