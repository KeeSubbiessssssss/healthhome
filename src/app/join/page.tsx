import type { Metadata } from "next";
import { currentUser } from "@/lib/household";
import { JoinInvitation } from "./join-invitation";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join your household | HealthHome", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function JoinPage() {
  const user = await currentUser();
  return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>A place for you, too.</h1><JoinInvitation user={user ? { email: user.email, emailVerified: user.emailVerified } : null}/></main>;
}
