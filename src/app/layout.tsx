import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Sydran Maps — Minecraft Map-Art Store",
  description:
    "Sydran Maps is a Minecraft map-art marketplace with full order lifecycle, delivery queue, large-map support up to 10×6, server-side duplicate detection, and live Fabric mod configuration.",
  keywords: [
    "Sydran Maps",
    "Minecraft map art",
    "map store",
    "map art delivery",
    "Fabric mod",
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
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
