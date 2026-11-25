import { isValidDate, longDate } from "@/lib/format";
import { OG_SIZE, fetchScoreRows, scoreCardImage } from "@/lib/og";
import RootImage from "@/app/opengraph-image";

export const runtime = "edge";
export const alt = "AI Sentiment Index — one day's reading of media sentiment toward AI";
export const size = OG_SIZE;
export const contentType = "image/png";

// Share card for a single day: the date and that day's reading. Falls back
// to the site-wide card if the day can't be loaded — never a broken image.
export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (isValidDate(date)) {
    const rows = await fetchScoreRows(date, date);
    if (rows) {
      try {
        return scoreCardImage({ eyebrow: "Daily reading", heading: longDate(date), ...rows[0] });
      } catch {
        // fall through to the site card
      }
    }
  }
  return RootImage();
}
