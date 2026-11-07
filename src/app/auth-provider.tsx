"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return <NeonAuthUIProvider defaultTheme="light" emailVerification={{ otp: true }} authClient={authClient} navigate={router.push} replace={router.replace} onSessionChange={() => router.refresh()} redirectTo="/join" Link={Link}>{children}</NeonAuthUIProvider>;
}
