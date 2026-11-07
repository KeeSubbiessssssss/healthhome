import localFont from "next/font/local";
import type { Metadata } from "next";
import "@neondatabase/auth-ui/css";
import "./globals.css";
import { AuthProvider } from "@/app/auth-provider";

const handwriting = localFont({ src: "../../public/fonts/PatrickHand-Regular.ttf", variable: "--font-handwriting", display: "swap", weight: "400", preload: true });

export const metadata: Metadata = {
  title: "HealthHome | Your household at a glance",
  description: "Your family pinboard for lists, medication, pets and presents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${handwriting.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
