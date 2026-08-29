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
  return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Welcome, {member.displayName}</h1><section className="data-lab-form"><h2>Dexcom connection</h2><p>{connection?.status === "connected" ? "Dexcom is connected. Sync the last 24 hours of available glucose readings." : "Connect Dexcom once its developer credentials are configured."}</p>{connection?.status === "connected" ? <form action="/api/dexcom/sync" method="post"><button type="submit">Sync Dexcom readings</button></form> : <a className="dexcom-link" href="/api/dexcom/connect">Connect Dexcom</a>}</section></main>;
}
