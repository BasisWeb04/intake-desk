import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intake Desk: job intake with safety routing, a rules engine and an optional LLM adapter",
  description:
    "Demo with fictional data: a chat intake for a fictional plumbing company with hard safety rules, a rules engine, an optional LLM extractor (tested against a mocked API) and a dispatch board.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
