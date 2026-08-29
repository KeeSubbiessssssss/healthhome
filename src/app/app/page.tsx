import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { dexcomConnections, glucoseReadings } from "@/db/schema";
import { currentMember, currentUser } from "@/lib/household";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const member = await currentMember();
  if (!member) redirect("/onboarding");
  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.householdMemberId, member.id)).limit(1);
  const [{ readingCount }] = connection ? await db.select({ readingCount: count() }).from(glucoseReadings).where(eq(glucoseReadings.connectionId, connection.id)) : [{ readingCount: 0 }];
  const isConnected = connection?.status === "connected";
  return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Welcome, {member.displayName}</h1><section className="data-lab-form"><h2>Dexcom connection</h2><p>{isConnected ? "Dexcom is connected. Sync the last 24 hours of available glucose readings." : connection ? "Dexcom needs to be connected again before we can sync." : "Connect Dexcom once its developer credentials are configured."}</p>{connection?.lastSyncedAt ? <p role="status">Latest sync complete — {readingCount} glucose readings are ready in Preview.</p> : null}{connection?.lastError ? <p role="status">{connection.lastError}</p> : null}{isConnected ? <form action="/api/dexcom/sync" method="post"><button type="submit">Sync Dexcom readings</button></form> : <a className="dexcom-link" href="/api/dexcom/connect">Connect Dexcom</a>}</section></main>;
}
