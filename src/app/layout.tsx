import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { BRAND_ICON_PATH } from "@/lib/brand";
import { getShopSeo } from "@/lib/get-shop-seo";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { name, shareDescription } = await getShopSeo();
  const siteUrl = getSiteUrl();

  return {
    metadataBase: siteUrl,
    title: {
      default: name,
      template: `%s | ${name}`,
    },
    description: shareDescription,
    icons: {
      icon: BRAND_ICON_PATH,
      apple: BRAND_ICON_PATH,
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: name,
      title: name,
      description: shareDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description: shareDescription,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
