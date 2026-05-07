import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/voto`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/quiz`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}

