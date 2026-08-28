import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthHome | Your household at a glance",
  description: "A private household dashboard for health data and shared inventory.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
