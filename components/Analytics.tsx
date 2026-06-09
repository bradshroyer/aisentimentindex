// Cloudflare Web Analytics (free, cookieless — no consent banner needed).
// The token is read from NEXT_PUBLIC_CF_BEACON_TOKEN so the beacon only loads
// where that variable is set: set it in Vercel for the Production environment
// only and leave Preview/Development unset, keeping local and preview traffic
// out of the numbers. Same env-gating pattern as veterandesign.com's GA4 tag.
export function Analytics() {
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;

  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
