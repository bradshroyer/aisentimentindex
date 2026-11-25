import { isValidMonth, monthEnd, monthLabel } from "@/lib/format";
import { OG_SIZE, fetchScoreRows, rollUp, scoreCardImage } from "@/lib/og";
import RootImage from "@/app/opengraph-image";

export const runtime = "edge";
export const alt = "AI Sentiment Index — one month of media sentiment toward AI";
export const size = OG_SIZE;
export const contentType = "image/png";

// Share card for a monthly recap: the month and its headline-weighted mean.
export default async function Image({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  if (isValidMonth(month)) {
    const rows = await fetchScoreRows(`${month}-01`, monthEnd(month));
    if (rows) {
      try {
        return scoreCardImage({ eyebrow: "Monthly recap", heading: monthLabel(month), ...rollUp(rows) });
      } catch {
        // fall through to the site card
      }
    }
  }
  return RootImage();
}
