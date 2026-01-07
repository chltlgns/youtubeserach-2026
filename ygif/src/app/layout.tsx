import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YGIF - YouTube Global Insight Finder",
  description: "Search YouTube videos across multiple countries with automatic keyword translation powered by Gemini AI",
  keywords: ["YouTube", "search", "global", "translation", "video", "analytics"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <footer className="py-4 text-center text-sm text-gray-500 border-t border-white/10">
              <p>YGIF - YouTube Global Insight Finder © 2026</p>
              <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
