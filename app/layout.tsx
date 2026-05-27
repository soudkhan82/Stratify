import "./globals.css";
import type { Metadata } from "next";
import TopNav from "./components/TopNav";

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
      <body>
        <TopNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
