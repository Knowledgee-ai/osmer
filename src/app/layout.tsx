import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Inter_Tight } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const interTight = Inter_Tight({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Knowledgee · The shape of organizational memory",
  description:
    "Every AI conversation in your company generates knowledge that today evaporates. Knowledgee captures it, refines it, and makes it the property of the organization, not the inbox of one employee.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${interTight.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden">
        <Providers>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
