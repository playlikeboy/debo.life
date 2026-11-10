import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://debo.life/", changeFrequency: "weekly", priority: 1 },
    { url: "https://debo.life/privacy", changeFrequency: "monthly", priority: 0.5 },
  ];
}
