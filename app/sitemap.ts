import type { MetadataRoute } from "next";
import { VOTO_CATEGORIES } from "@/lib/voto-categories";
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
    ...VOTO_CATEGORIES.filter((c) => c.id !== "hyundai").map((c) => ({
      url: `${SITE_URL}/voto/${c.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/quiz`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}

