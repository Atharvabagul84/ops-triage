import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpsTriage — Kubernetes Incident Practice",
  description: "Practice Kubernetes incident diagnosis with simulated evidence, guided investigations, and a personal troubleshooting notebook.",
  keywords: ["Kubernetes troubleshooting", "DevOps practice", "SRE learning", "kubectl", "OpsTriage"],
  authors: [{ name: "Atharva Bagul" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#080b11] text-zinc-200 font-sans">
        {children}
      </body>
    </html>
  );
}
