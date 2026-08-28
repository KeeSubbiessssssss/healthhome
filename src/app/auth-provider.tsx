"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return <NeonAuthUIProvider authClient={authClient} navigate={router.push} replace={router.replace} onSessionChange={() => router.refresh()} redirectTo="/app" Link={Link}>{children}</NeonAuthUIProvider>;
}
