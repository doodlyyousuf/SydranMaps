import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sydran Maps — Minecraft Map-Art Store",
  description:
    "Sydran Maps is a Minecraft map-art marketplace. Pick a piece, pay in-game, and the maps are delivered to your in-game /order.",
  keywords: [
    "Sydran Maps",
    "Minecraft map art",
    "map store",
    "map art delivery",
    "Minecraft marketplace",
  ],
  authors: [{ name: "Sydran Maps" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${archivo.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
