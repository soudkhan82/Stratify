import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stratify Analytics",
  description: "Global intelligence analytics portal",
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
