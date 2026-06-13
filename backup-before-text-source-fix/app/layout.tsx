import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import TopNav from "./components/TopNav";
import DataSourceBanner from "./components/DataSourceBanner";

export const metadata: Metadata = {
  title: "Stratify Analytics",
  description: "Global intelligence analytics portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        <DataSourceBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}
