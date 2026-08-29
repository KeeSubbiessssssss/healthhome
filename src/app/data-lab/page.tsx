import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { addMedication, dayConsumed, doseConsumed, filledRepeat } from "@/app/data-lab/actions";
import { medications, prescriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember, currentUser } from "@/lib/household";

export const dynamic = "force-dynamic";

const medicationTypes = [
  ["tablet", "Tablet"],
  ["injection", "Injectable"],
  ["aerosol", "Aerosol"],
  ["liquid", "Liquid"],
  ["cream", "Cream"],
  ["other", "Other"],
] as const;

function displayNumber(value: number | null) {
  return value === null ? "—" : String(value);
}

export default async function DataLabPage() {
  if (process.env.VERCEL_ENV === "production") {
    return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Data lab is available in Preview.</h1><p>Production never accepts test data.</p></main>;
  }

  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const member = await currentMember();
  if (!member) redirect("/onboarding");

  const scripts = await db
    .select({
      prescriptionId: prescriptions.id,
      pharmaceuticalName: medications.name,
      streetName: medications.genericName,
      type: medications.form,
      strength: medications.strengthLabel,
      totalDosesPerScript: prescriptions.totalDosesPerScript,
      totalDaysPerScript: prescriptions.totalDaysPerScript,
      repeatsPerScript: prescriptions.repeatsAuthorized,
      scriptExpiresOn: prescriptions.scriptExpiresOn,
      refillAtDaysLeft: prescriptions.refillAtDaysLeft,
      doseAmount: prescriptions.doseAmount,
      doseForm: prescriptions.doseForm,
      doseStrength: prescriptions.doseStrengthLabel,
      frequency: prescriptions.frequency,
      dosesLeft: prescriptions.dosesLeft,
      daysLeft: prescriptions.daysLeft,
      repeatsLeft: prescriptions.repeatsRemaining,
    })
    .from(prescriptions)
    .innerJoin(medications, eq(prescriptions.medicationId, medications.id))
    .where(and(eq(medications.householdId, member.householdId), eq(prescriptions.isActive, true)))
    .orderBy(desc(prescriptions.createdAt));

  return (
    <main className="data-lab-shell">
      <p className="eyebrow">HealthHome · Preview only</p>
      <h1>Medication tracking data lab</h1>
      <p className="data-lab-intro">Test the exact medication, dosing and tracking fields before the full product UI is designed. This Preview data stays isolated from production.</p>

      <section className="data-lab-form">
        <h2>Add medication script</h2>
        <form action={addMedication} className="medication-form medication-script-form">
          <fieldset>
            <legend>Medication</legend>
            <label>Medication Pharm Name<input name="pharmaceuticalName" required placeholder="e.g. Lantus" /></label>
            <label>Medication Street Name<input name="streetName" required placeholder="e.g. Insulin glargine" /></label>
            <label>Type<select name="type" required>{medicationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Strength<input name="strength" required placeholder="e.g. 100 units/mL" /></label>
            <label>Total Doses Per Script<input name="totalDosesPerScript" required inputMode="numeric" min="1" step="1" placeholder="28" /></label>
            <label>Total Days Per Script<input name="totalDaysPerScript" required inputMode="numeric" min="1" step="1" placeholder="28" /></label>
            <label>Repeats Per Script<input name="repeatsPerScript" required inputMode="numeric" min="0" step="1" placeholder="5" /></label>
            <label>Script Expiry<input name="scriptExpiresOn" type="date" /></label>
            <label>Refill at <span>Days left</span><input name="refillAtDaysLeft" required inputMode="numeric" min="0" step="1" placeholder="7" /></label>
          </fieldset>

          <fieldset>
            <legend>Doseing</legend>
            <label>Dose<input name="doseAmount" required inputMode="decimal" min="0.01" step="0.01" placeholder="1" /></label>
            <label>Type<select name="doseForm" required>{medicationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Dose Strength<input name="doseStrength" required placeholder="e.g. 10 units" /></label>
            <label>Frequency<input name="frequency" required placeholder="e.g. Once daily" /></label>
          </fieldset>

          <button type="submit">Save Preview medication</button>
        </form>
      </section>

      {scripts.length === 0 ? <section className="data-lab-empty"><h2>No medication scripts yet</h2><p>Save one above to test the tracking counters and refill behaviour.</p></section> : (
        <section className="script-list" aria-label="Medication scripts">
          {scripts.map((script) => {
            const doseAction = doseConsumed.bind(null, script.prescriptionId);
            const dayAction = dayConsumed.bind(null, script.prescriptionId);
            const repeatAction = filledRepeat.bind(null, script.prescriptionId);
            const needsRefill = script.refillAtDaysLeft !== null && script.daysLeft !== null && script.daysLeft <= script.refillAtDaysLeft;
            return <article className="script-card" key={script.prescriptionId}>
              <header><div><p className="eyebrow">{script.type}</p><h2>{script.pharmaceuticalName}</h2><p>{script.streetName || "No street name"} · {script.strength || "Strength not set"}</p></div><span className={needsRefill ? "status status-warning" : "status"}>{needsRefill ? "Refill due" : "Tracking"}</span></header>
              <dl className="script-details"><div><dt>Total doses</dt><dd>{displayNumber(script.totalDosesPerScript)}</dd></div><div><dt>Total days</dt><dd>{displayNumber(script.totalDaysPerScript)}</dd></div><div><dt>Repeats per script</dt><dd>{displayNumber(script.repeatsPerScript)}</dd></div><div><dt>Script expiry</dt><dd>{script.scriptExpiresOn || "—"}</dd></div><div><dt>Refill at</dt><dd>{displayNumber(script.refillAtDaysLeft)} days left</dd></div></dl>
              <section className="dosing-section"><h3>Doseing</h3><p>{script.doseAmount || "—"} {script.doseForm || ""} · {script.doseStrength || "Strength not set"}</p><small>{script.frequency || "Frequency not set"}</small></section>
              <section className="tracking-section"><h3>Tracking</h3><div className="tracking-grid"><div><span>Doses Left</span><strong>{displayNumber(script.dosesLeft)}</strong></div><div><span>Days Left</span><strong>{displayNumber(script.daysLeft)}</strong></div><div><span>Repeats Left</span><strong>{displayNumber(script.repeatsLeft)}</strong></div></div><p className="tracking-note">Filled Repeat carries any remaining doses and days forward, then adds this script’s totals.</p><div className="tracking-actions"><form action={doseAction}><button type="submit">Dose Consumed</button></form><form action={dayAction}><button type="submit">Day Consumed</button></form><form action={repeatAction}><button type="submit">Filled Repeat</button></form></div></section>
            </article>;
          })}
        </section>
      )}
    </main>
  );
}
