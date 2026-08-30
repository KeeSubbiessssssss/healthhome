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

function displayUnits(value: string | null) {
  return value === null ? "—" : Number(value).toFixed(2).replace(/\.00$/, "");
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
      totalUnitsPerScript: prescriptions.totalUnitsPerScript,
      unitsPerDose: prescriptions.unitsPerDose,
      dosesPerDay: prescriptions.dosesPerDay,
      totalDosesPerScript: prescriptions.totalDosesPerScript,
      totalDaysPerScript: prescriptions.totalDaysPerScript,
      repeatsPerScript: prescriptions.repeatsAuthorized,
      scriptExpiresOn: prescriptions.scriptExpiresOn,
      refillAtDaysLeft: prescriptions.refillAtDaysLeft,
      doseForm: prescriptions.doseForm,
      doseStrength: prescriptions.doseStrengthLabel,
      frequency: prescriptions.frequency,
      unitsLeft: prescriptions.unitsLeft,
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
      <p className="data-lab-intro">Enter physical units once. HealthHome calculates full doses and full days from those values, then keeps them in sync as you record consumption or refill a repeat.</p>

      <section className="data-lab-form">
        <h2>Add medication script</h2>
        <form action={addMedication} className="medication-form medication-script-form">
          <fieldset>
            <legend>Medication</legend>
            <label>Medication Pharm Name<input name="pharmaceuticalName" required placeholder="e.g. Lantus" /></label>
            <label>Medication Street Name<input name="streetName" required placeholder="e.g. Insulin glargine" /></label>
            <label>Type<select name="type" required>{medicationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Strength<input name="strength" required placeholder="e.g. 40 mg" /></label>
            <label>Total Units Per Script<input name="totalUnitsPerScript" required inputMode="decimal" min="0.01" step="0.01" placeholder="112" /></label>
            <label>Doses Per Day<input name="dosesPerDay" required inputMode="numeric" min="1" step="1" placeholder="1" /></label>
            <label>Repeats Per Script<input name="repeatsPerScript" required inputMode="numeric" min="0" step="1" placeholder="5" /></label>
            <label>Script Expiry<input name="scriptExpiresOn" type="date" /></label>
            <label>Refill at <span>Days left</span><input name="refillAtDaysLeft" required inputMode="numeric" min="0" step="1" placeholder="7" /></label>
          </fieldset>

          <fieldset>
            <legend>Doseing</legend>
            <label>Units Per Dose<input name="unitsPerDose" required inputMode="decimal" min="0.01" step="0.01" placeholder="4" /></label>
            <label>Type<select name="doseForm" required>{medicationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Dose Strength <span>Optional</span><input name="doseStrength" placeholder="e.g. 160 mg" /></label>
            <p className="calculation-hint">Frequency is calculated from Doses Per Day. Total doses and full days are calculated from the units above.</p>
          </fieldset>

          <button type="submit">Save Preview medication</button>
        </form>
      </section>

      {scripts.length === 0 ? <section className="data-lab-empty"><h2>No medication scripts yet</h2><p>Save one above to test the units, doses, days and refill behaviour.</p></section> : (
        <section className="script-list" aria-label="Medication scripts">
          {scripts.map((script) => {
            const doseAction = doseConsumed.bind(null, script.prescriptionId);
            const dayAction = dayConsumed.bind(null, script.prescriptionId);
            const repeatAction = filledRepeat.bind(null, script.prescriptionId);
            const needsRefill = script.refillAtDaysLeft !== null && script.daysLeft !== null && script.daysLeft <= script.refillAtDaysLeft;
            return <article className="script-card" key={script.prescriptionId}>
              <header><div><p className="eyebrow">{script.type}</p><h2>{script.pharmaceuticalName}</h2><p>{script.streetName || "No street name"} · {script.strength || "Strength not set"}</p></div><span className={needsRefill ? "status status-warning" : "status"}>{needsRefill ? "Refill due" : "Tracking"}</span></header>
              <dl className="script-details"><div><dt>Total units</dt><dd>{displayUnits(script.totalUnitsPerScript)}</dd></div><div><dt>Units per dose</dt><dd>{displayUnits(script.unitsPerDose)}</dd></div><div><dt>Doses per day</dt><dd>{displayNumber(script.dosesPerDay)}</dd></div><div><dt>Total doses</dt><dd>{displayNumber(script.totalDosesPerScript)}</dd></div><div><dt>Total full days</dt><dd>{displayNumber(script.totalDaysPerScript)}</dd></div><div><dt>Repeats per script</dt><dd>{displayNumber(script.repeatsPerScript)}</dd></div><div><dt>Script expiry</dt><dd>{script.scriptExpiresOn || "—"}</dd></div><div><dt>Refill at</dt><dd>{displayNumber(script.refillAtDaysLeft)} days left</dd></div></dl>
              <section className="dosing-section"><h3>Doseing</h3><p>{displayUnits(script.unitsPerDose)} {script.doseForm || "units"}{script.doseStrength ? ` · ${script.doseStrength}` : ""}</p><small>{script.frequency || "Frequency not set"}</small></section>
              <section className="tracking-section"><h3>Tracking</h3><div className="tracking-grid tracking-grid-four"><div><span>Units Left</span><strong>{displayUnits(script.unitsLeft)}</strong></div><div><span>Doses Left</span><strong>{displayNumber(script.dosesLeft)}</strong></div><div><span>Days Left</span><strong>{displayNumber(script.daysLeft)}</strong></div><div><span>Repeats Left</span><strong>{displayNumber(script.repeatsLeft)}</strong></div></div><p className="tracking-note">Dose Consumed removes one dose’s units. Day Consumed removes a full day’s units only. Filled Repeat carries remaining units forward, then adds the new script’s units.</p><div className="tracking-actions"><form action={doseAction}><button type="submit">Dose Consumed</button></form><form action={dayAction}><button type="submit">Day Consumed</button></form><form action={repeatAction}><button type="submit">Filled Repeat</button></form></div></section>
            </article>;
          })}
        </section>
      )}
    </main>
  );
}
