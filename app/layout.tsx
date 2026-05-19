import type { Metadata } from "next";
import "./globals.css";
import "@maptiler/sdk/dist/maptiler-sdk.css";

export const metadata: Metadata = {
  title: "Baltic Monitor",
  description: "Regional situational awareness — Baltic & Nordic",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}