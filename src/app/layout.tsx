import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MSIH — MetTechnik Sales Intelligence Hub | CRM V1.0",
  description:
    "Centralized Sales Intelligence Platform for MetTechnik Pvt. Ltd. Manage enquiries, follow-ups, quotations, and gain AI-driven sales insights. CRM V1.0 by Manoj Dore.",
  keywords: [
    "MSIH", "MetTechnik", "CRM", "Sales Intelligence", "Lead Management",
    "Hardness Testers", "Microscopes", "Metallography", "Manoj Dore",
  ],
  authors: [{ name: "Manoj Dore" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
