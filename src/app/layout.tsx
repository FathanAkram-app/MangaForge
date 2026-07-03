import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({ variable: "--font-syne", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "MangaForge — AI manga panel generator",
  description: "Generate manga-style panels, covers, and character art from a prompt. Your gallery, saved.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
