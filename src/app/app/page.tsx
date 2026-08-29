import { count, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { dexcomConnections, glucoseReadings } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember, currentUser } from "@/lib/household";

export const dynamic = "force-dynamic";

function mmol(valueMgDl: number) {
  return (valueMgDl / 18).toFixed(1);
}

function formatReadingTime(recordedAt: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Brisbane",
  }).format(recordedAt);
}

function formatTrendRate(rate: string | null) {
  if (!rate) return "Trend rate not available";
  const value = Number(rate);
  if (Number.isNaN(value)) return "Trend rate not available";
  return `Trend rate ${value > 0 ? "+" : ""}${value.toFixed(1)} mg/dL/min`;
}

export default async function AppPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");

  const member = await currentMember();
  if (!member) redirect("/onboarding");

  const [connection] = await db
    .select()
    .from(dexcomConnections)
    .where(eq(dexcomConnections.householdMemberId, member.id))
    .limit(1);
  const [{ readingCount }] = connection ? await db.select({ readingCount: count() }).from(glucoseReadings).where(eq(glucoseReadings.connectionId, connection.id)) : [{ readingCount: 0 }];
  const [latestReading] = connection ? await db.select().from(glucoseReadings).where(eq(glucoseReadings.connectionId, connection.id)).orderBy(desc(glucoseReadings.recordedAt)).limit(1) : [];
  const recentReadings = connection ? await db.select().from(glucoseReadings).where(eq(glucoseReadings.connectionId, connection.id)).orderBy(desc(glucoseReadings.recordedAt)).limit(8) : [];
  const isConnected = connection?.status === "connected";

  return (
    <main className="data-lab-shell">
      <p className="eyebrow">HealthHome</p>
      <h1>Welcome, {member.displayName}</h1>
      <p className="data-lab-intro">A simple Preview view of the glucose data currently available through Dexcom.</p>

      <section className="data-lab-form">
        <h2>Dexcom connection</h2>
        <p>{isConnected ? "Dexcom is connected. Sync recent available glucose readings whenever you need a refresh." : connection ? "Dexcom needs to be connected again before we can sync." : "Connect Dexcom once its developer credentials are configured."}</p>
        {connection?.lastSyncedAt ? <p className="sync-status" role="status">Latest sync complete — {readingCount} glucose readings are ready in Preview.</p> : null}
        {connection?.lastError ? <p className="sync-error" role="status">{connection.lastError}</p> : null}
        {isConnected ? <form action="/api/dexcom/sync" method="post"><button type="submit">Sync Dexcom readings</button></form> : <a className="dexcom-link" href="/api/dexcom/connect">Connect Dexcom</a>}
      </section>

      <section aria-labelledby="glucose-heading">
        <div className="glucose-section-heading">
          <div>
            <p className="eyebrow">Glucose</p>
            <h2 id="glucose-heading">Most recent available reading</h2>
          </div>
          {latestReading ? <span className="status">Preview data</span> : null}
        </div>

        {latestReading ? (
          <div className="glucose-summary">
            <div>
              <p className="glucose-summary-label">Glucose</p>
              <p className="glucose-summary-value">{mmol(latestReading.valueMgDl)} <span>mmol/L</span></p>
              <p className="glucose-summary-secondary">{latestReading.valueMgDl} mg/dL</p>
            </div>
            <div className="glucose-summary-detail">
              <strong>Recorded</strong>
              <span>{formatReadingTime(latestReading.recordedAt)}</span>
              <small>{formatTrendRate(latestReading.trendRate)}</small>
            </div>
          </div>
        ) : <div className="data-lab-empty"><h2>No glucose readings yet</h2><p>Connect Dexcom, then run a sync to populate this Preview view.</p></div>}
      </section>

      {recentReadings.length > 0 ? (
        <section className="glucose-history" aria-labelledby="history-heading">
          <div className="glucose-section-heading">
            <div><p className="eyebrow">History</p><h2 id="history-heading">Recent readings</h2></div>
            <span>{readingCount} saved</span>
          </div>
          <div className="data-lab-table-wrap">
            <table>
              <thead><tr><th>Recorded</th><th>mmol/L</th><th>mg/dL</th><th>Trend</th></tr></thead>
              <tbody>{recentReadings.map((reading) => <tr key={reading.id}><td>{formatReadingTime(reading.recordedAt)}</td><td>{mmol(reading.valueMgDl)}</td><td>{reading.valueMgDl}</td><td>{formatTrendRate(reading.trendRate)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
