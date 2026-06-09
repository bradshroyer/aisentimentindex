import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const siteUrl = SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
