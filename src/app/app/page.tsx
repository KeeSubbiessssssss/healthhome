import { and, count, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

import { dexcomConnections, glucoseReadings, medicationActivityEvents, medications, prescriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember, currentUser } from "@/lib/household";
import { DexcomRefresh } from "@/app/app/dexcom-refresh";

export const dynamic = "force-dynamic";

function mmol(valueMgDl: number) {
  return (valueMgDl / 18).toFixed(1);
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane" }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Brisbane" }).format(value);
}

function activityLabel(eventType: string) {
  return { script_created: "Medication added", script_updated: "Medication updated", script_archived: "Medication removed", dose_consumed: "Dose consumed", day_consumed: "Day consumed", repeat_filled: "Repeat filled", dose_reversed: "Dose restored", day_reversed: "Day restored", repeat_reversed: "Repeat fill reversed" }[eventType] ?? eventType;
}

function displayUnits(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(2).replace(/\.00$/, "");
}

export default async function AppPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const member = await currentMember();
  if (!member) redirect("/onboarding");

  const [connection] = await db.select().from(dexcomConnections).where(eq(dexcomConnections.householdMemberId, member.id)).limit(1);
  const [glucoseCount] = connection ? await db.select({ value: count() }).from(glucoseReadings).where(eq(glucoseReadings.connectionId, connection.id)) : [{ value: 0 }];
  const [latestReading] = connection ? await db.select().from(glucoseReadings).where(eq(glucoseReadings.connectionId, connection.id)).orderBy(desc(glucoseReadings.recordedAt)).limit(1) : [];
  const activeScripts = await db.select({ prescriptionId: prescriptions.id, pharmaceuticalName: medications.name, streetName: medications.genericName, form: medications.form, strength: medications.strengthLabel, unitsLeft: prescriptions.unitsLeft, daysLeft: prescriptions.daysLeft, refillAtDaysLeft: prescriptions.refillAtDaysLeft, refillAtUnitsLeft: prescriptions.refillAtUnitsLeft }).from(prescriptions).innerJoin(medications, eq(prescriptions.medicationId, medications.id)).where(and(eq(medications.householdId, member.householdId), eq(prescriptions.isActive, true))).orderBy(desc(prescriptions.updatedAt));
  const refillAttention = activeScripts.filter((script) => script.form === "injection" ? script.unitsLeft !== null && script.refillAtUnitsLeft !== null && Number(script.unitsLeft) <= Number(script.refillAtUnitsLeft) : script.daysLeft !== null && script.refillAtDaysLeft !== null && script.daysLeft <= script.refillAtDaysLeft);
  const activity = activeScripts.length === 0 ? [] : await db.select({ id: medicationActivityEvents.id, prescriptionId: medicationActivityEvents.prescriptionId, eventType: medicationActivityEvents.eventType, summary: medicationActivityEvents.summary, unitsDelta: medicationActivityEvents.unitsDelta, repeatsDelta: medicationActivityEvents.repeatsDelta, createdAt: medicationActivityEvents.createdAt }).from(medicationActivityEvents).where(inArray(medicationActivityEvents.prescriptionId, activeScripts.map((script) => script.prescriptionId))).orderBy(desc(medicationActivityEvents.createdAt)).limit(6);
  const scriptNames = new Map(activeScripts.map((script) => [script.prescriptionId, script.pharmaceuticalName]));
  const isConnected = connection?.status === "connected";

  return <main className="data-lab-shell household-dashboard">
    <header className="household-dashboard-header"><div><p className="eyebrow">HealthHome</p><h1>Your household, at a glance.</h1><p>Hi {member.displayName}. Here&apos;s the current picture from your connected health services and medication tracking.</p></div><div className="dashboard-header-actions"><DexcomRefresh connected={isConnected} /><a className="dashboard-link dashboard-link-quiet" href="/data-lab">Manage medications</a></div></header>
    <section className="dashboard-metric-grid" aria-label="Household overview">
      <article className="dashboard-metric dashboard-metric-glucose"><div className="dashboard-card-heading"><p>Latest glucose</p><span className={latestReading ? "status" : "status status-warning"}>{latestReading ? "Dexcom" : "No reading"}</span></div>{latestReading ? <><strong>{mmol(latestReading.valueMgDl)} <small>mmol/L</small></strong><p>{latestReading.valueMgDl} mg/dL · {formatTime(latestReading.recordedAt)}</p></> : <><strong>—</strong><p>{isConnected ? "Refreshing when you open the dashboard." : "Connect Dexcom to begin."}</p></>}<p className="dashboard-refresh-note">Use the refresh control above whenever you want a fresh pull.</p></article>
      <article className="dashboard-metric"><div className="dashboard-card-heading"><p>Active scripts</p><span className="dashboard-icon">Rx</span></div><strong>{activeScripts.length}</strong><p>{activeScripts.length === 1 ? "medication currently tracked" : "medications currently tracked"}</p><a className="dashboard-text-button" href="/data-lab">Open data lab</a></article>
      <article className={refillAttention.length > 0 ? "dashboard-metric dashboard-metric-attention" : "dashboard-metric"}><div className="dashboard-card-heading"><p>Refill attention</p><span className={refillAttention.length > 0 ? "status status-warning" : "status"}>{refillAttention.length > 0 ? "Action needed" : "All clear"}</span></div><strong>{refillAttention.length}</strong><p>{refillAttention.length === 1 ? "script is at its refill point" : refillAttention.length > 1 ? "scripts are at their refill point" : "no scripts are at their refill point"}</p><a className="dashboard-text-button" href="#medication-attention">Review medication</a></article>
    </section>
    <section className="dashboard-columns">
      <article className="dashboard-panel" id="medication-attention"><div className="dashboard-panel-heading"><div><p className="eyebrow">Medication</p><h2>{refillAttention.length > 0 ? "Needs attention" : "Current supply"}</h2></div><a href="/data-lab">View all</a></div>{activeScripts.length === 0 ? <div className="dashboard-empty"><h3>No medication scripts yet</h3><p>Add a script in the Preview data lab to begin tracking units, doses, days, and repeats.</p><a className="dashboard-link" href="/data-lab">Add medication</a></div> : <ul className="dashboard-list">{(refillAttention.length > 0 ? refillAttention : activeScripts).slice(0, 4).map((script) => { const needsRefill = refillAttention.some((item) => item.prescriptionId === script.prescriptionId); const injectable = script.form === "injection"; return <li key={script.prescriptionId}><div className={needsRefill ? "dashboard-list-mark dashboard-list-mark-warning" : "dashboard-list-mark"}>{script.form.slice(0, 1).toUpperCase()}</div><div><strong>{script.pharmaceuticalName}</strong><span>{script.streetName ?? script.strength ?? "Medication script"}</span></div><div className="dashboard-list-meta"><b>{injectable ? displayUnits(script.unitsLeft) : script.daysLeft ?? "—"}</b><span>{injectable ? "units left" : "days left"}</span></div><span className={needsRefill ? "status status-warning" : "status"}>{needsRefill ? "Refill due" : `${displayUnits(script.unitsLeft)} left`}</span></li>; })}</ul>}</article>
      <article className="dashboard-panel"><div className="dashboard-panel-heading"><div><p className="eyebrow">Activity</p><h2>Recent changes</h2></div><span>{activity.length} shown</span></div>{activity.length === 0 ? <div className="dashboard-empty"><h3>No activity recorded yet</h3><p>Medication actions you take in the data lab will appear here.</p></div> : <ol className="dashboard-activity">{activity.map((event) => <li key={event.id}><div><strong>{activityLabel(event.eventType)}</strong><span>{scriptNames.get(event.prescriptionId)} · {event.summary}</span></div><small>{formatTime(event.createdAt)}{Number(event.unitsDelta) !== 0 ? ` · ${Number(event.unitsDelta) > 0 ? "+" : ""}${displayUnits(event.unitsDelta)} units` : ""}{event.repeatsDelta !== 0 ? ` · ${event.repeatsDelta > 0 ? "+" : ""}${event.repeatsDelta} repeat` : ""}</small></li>)}</ol>}</article>
    </section>
    <section className="dashboard-glucose-status"><div><p className="eyebrow">Dexcom status</p><h2>{isConnected ? "Connected and ready to refresh" : "Connection needs attention"}</h2><p>{connection?.lastSyncedAt ? `Last sync completed ${formatDate(connection.lastSyncedAt)}. ${glucoseCount.value} glucose readings are stored in Preview.` : isConnected ? "Dexcom refreshes when you open or return to this dashboard." : "Connect or reconnect Dexcom to bring glucose readings into HealthHome."}</p></div></section>
  </main>;
}
