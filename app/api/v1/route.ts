import { apiMeta, json } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

// API index: lists the endpoints so the root URL is self-describing.
export const revalidate = 21600;

export async function GET() {
  return json({
    ...apiMeta(),
    endpoints: {
      latest: `${SITE_URL}/api/v1/latest`,
      daily: `${SITE_URL}/api/v1/daily`,
      daily_csv: `${SITE_URL}/api/v1/daily.csv`,
      outlets: `${SITE_URL}/api/v1/outlets`,
      feed: `${SITE_URL}/feed.xml`,
    },
    bulk_download: "https://github.com/bradshroyer/aisentimentindex/tree/main/data/export",
  });
}
