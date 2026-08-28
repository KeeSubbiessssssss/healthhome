import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { dexcomConnections } from "@/db/schema";
import { currentMember, currentUser } from "@/lib/household";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const member = await currentMember();
  if (!member) redirect("/onboarding");
  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.householdMemberId, member.id)).limit(1);
  return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Welcome, {member.displayName}</h1><section className="data-lab-form"><h2>Dexcom connection</h2><p>{connection?.status === "connected" ? "Dexcom is connected. A secure sync service is the next step." : "Connect Dexcom once its developer credentials are configured."}</p><a className="dexcom-link" href="/api/dexcom/connect">Connect Dexcom</a></section></main>;
}
