import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"], display: "swap" });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Afrikob Pay", template: "%s · Afrikob Pay" },
  description: "Move money and account for it: collections, disbursements, refunds and tenant administration on the Afrikob gateway.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ee8434",
  width: "device-width",
  initialScale: 1,
};

/** Applies the persisted theme before paint to avoid a light flash. */
const themeScript = `try{var t=JSON.parse(localStorage.getItem('afk-ui')||'{}').state?.theme;if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${publicSans.variable} ${bricolage.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
