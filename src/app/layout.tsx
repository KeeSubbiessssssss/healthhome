import type { Metadata } from "next";
import "@neondatabase/auth-ui/css";
import "./globals.css";
import { AuthProvider } from "@/app/auth-provider";

export const metadata: Metadata = {
  title: "HealthHome | Your household at a glance",
  description: "A private household dashboard for health data and shared inventory.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
