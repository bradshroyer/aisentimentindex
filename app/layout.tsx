import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = new URL("https://labs.bradshroyer.com");

export const metadata: Metadata = {
  title: "AI Sentiment Index",
  description:
    "Tracking how major news outlets talk about AI — sentiment analysis across 14 sources.",
  metadataBase: siteUrl,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "AI Sentiment Index",
    description:
      "Tracking how major news outlets talk about AI — sentiment analysis across 14 sources.",
    url: "/",
    siteName: "AI Sentiment Index",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Sentiment Index",
    description:
      "Tracking how major news outlets talk about AI — sentiment analysis across 14 sources.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${jetbrainsMono.variable} ${dmSans.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='light'?false:t==='dark'||true;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg text-text-primary font-sans transition-colors">
        {children}
      </body>
    </html>
  );
}
