import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Quick",
  description: "Global speed challenges",

  // ✅ PWA / install support
  applicationName: "Quick",
  manifest: "/manifest.webmanifest",
  themeColor: "#1e3a8a",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-[100svh]">{children}</body>
    </html>
  );
}
