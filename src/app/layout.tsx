import type { Metadata } from "next";
import { Manrope, Sora, Space_Grotesk } from "next/font/google";
import "./globals.css";

import { ClientErrorReporter } from "@/components/ClientErrorReporter";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LNovel Author Studio",
  description: "Studio de creation de light novels data-driven",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} ${spaceGrotesk.variable} ${sora.variable}`}>
        <ClientErrorReporter />
        {children}</body>
    </html>
  );
}
