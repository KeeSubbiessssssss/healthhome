import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { addMedication, archiveMedication, dayConsumed, doseConsumed, filledRepeat, undoDayConsumed, undoDoseConsumed, undoFilledRepeat, updateMedication } from "@/app/data-lab/actions";
import { SaveMedicationButton } from "@/app/data-lab/submit-button";
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

export default async function DataLabPage({
  searchParams,
}: {
  searchParams: Promise<{ medication?: string; edit?: string; remove?: string; correct?: string }>;
}) {
  if (process.env.VERCEL_ENV === "production") {
    return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Data lab is available in Preview.</h1><p>Production never accepts test data.</p></main>;
  }

  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const member = await currentMember();
  if (!member) redirect("/onboarding");
  const { medication, edit, remove, correct } = await searchParams;

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
      {medication === "saved" ? <p className="save-confirmation" role="status">Medication script saved. Its tracking card is below.</p> : null}
      {medication === "updated" ? <p className="save-confirmation" role="status">Medication script updated. Tracking totals were recalculated from the current units you entered.</p> : null}
      {medication === "removed" ? <p className="save-confirmation" role="status">Medication removed from your active list. Its existing Preview record has been kept safely as archived history.</p> : null}
      {medication === "corrected" ? <p className="save-confirmation" role="status">Tracking corrected. Review the updated units, doses, days and repeats below.</p> : null}

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

          <SaveMedicationButton />
        </form>
      </section>

      {scripts.length === 0 ? <section className="data-lab-empty"><h2>No medication scripts yet</h2><p>Save one above to test the units, doses, days and refill behaviour.</p></section> : (
        <section className="script-list" aria-label="Medication scripts">
          {scripts.map((script) => {
            const doseAction = doseConsumed.bind(null, script.prescriptionId);
            const dayAction = dayConsumed.bind(null, script.prescriptionId);
            const repeatAction = filledRepeat.bind(null, script.prescriptionId);
            const updateAction = updateMedication.bind(null, script.prescriptionId);
            const archiveAction = archiveMedication.bind(null, script.prescriptionId);
            const undoDoseAction = undoDoseConsumed.bind(null, script.prescriptionId);
            const undoDayAction = undoDayConsumed.bind(null, script.prescriptionId);
            const undoRepeatAction = undoFilledRepeat.bind(null, script.prescriptionId);
            const isEditing = edit === script.prescriptionId;
            const isRemoving = remove === script.prescriptionId;
            const isCorrecting = correct === script.prescriptionId;
            const needsRefill = script.refillAtDaysLeft !== null && script.daysLeft !== null && script.daysLeft <= script.refillAtDaysLeft;
            return <article className="script-card" key={script.prescriptionId}>
              <header><div><p className="eyebrow">{script.type}</p><h2>{script.pharmaceuticalName}</h2><p>{script.streetName || "No street name"} · {script.strength || "Strength not set"}</p></div><div className="script-card-actions"><span className={needsRefill ? "status status-warning" : "status"}>{needsRefill ? "Refill due" : "Tracking"}</span><Link className="action-link" href={`/data-lab?edit=${script.prescriptionId}`}>Edit</Link><Link className="action-link" href={`/data-lab?correct=${script.prescriptionId}`}>Correct / undo</Link><Link className="action-link action-link-danger" href={`/data-lab?remove=${script.prescriptionId}`}>Remove</Link></div></header>
              {isEditing ? <section className="edit-script" aria-label={`Edit ${script.pharmaceuticalName}`}><h3>Edit medication script</h3><p>Set the actual units and repeats left now. HealthHome recalculates full doses and days from those values.</p><form action={updateAction} className="medication-form medication-script-form"><fieldset><legend>Medication</legend><label>Medication Pharm Name<input name="pharmaceuticalName" required defaultValue={script.pharmaceuticalName} /></label><label>Medication Street Name<input name="streetName" required defaultValue={script.streetName || ""} /></label><label>Type<select name="type" required defaultValue={script.type}>{medicationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Strength<input name="strength" required defaultValue={script.strength || ""} /></label><label>Total Units Per Script<input name="totalUnitsPerScript" required inputMode="decimal" min="0.01" step="0.01" defaultValue={script.totalUnitsPerScript || ""} /></label><label>Doses Per Day<input name="dosesPerDay" required inputMode="numeric" min="1" step="1" defaultValue={script.dosesPerDay ?? ""} /></label><label>Repeats Per Script<input name="repeatsPerScript" required inputMode="numeric" min="0" step="1" defaultValue={script.repeatsPerScript ?? ""} /></label><label>Script Expiry<input name="scriptExpiresOn" type="date" defaultValue={script.scriptExpiresOn || ""} /></label><label>Refill at <span>Days left</span><input name="refillAtDaysLeft" required inputMode="numeric" min="0" step="1" defaultValue={script.refillAtDaysLeft ?? ""} /></label></fieldset><fieldset><legend>Doseing</legend><label>Units Per Dose<input name="unitsPerDose" required inputMode="decimal" min="0.01" step="0.01" defaultValue={script.unitsPerDose || ""} /></label><label>Type<select name="doseForm" required defaultValue={script.doseForm || "other"}>{medicationTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Dose Strength <span>Optional</span><input name="doseStrength" defaultValue={script.doseStrength || ""} /></label><label>Units Left <span>Actual current stock</span><input name="unitsLeft" required inputMode="decimal" min="0" step="0.01" defaultValue={script.unitsLeft || "0"} /></label><label>Repeats Left<input name="repeatsLeft" required inputMode="numeric" min="0" step="1" defaultValue={script.repeatsLeft ?? 0} /></label><p className="calculation-hint">Changing units left, units per dose or doses per day recalculates doses left and full days left. A value of zero is allowed for current units.</p></fieldset><div className="edit-actions"><SaveMedicationButton idleLabel="Save changes" pendingLabel="Saving changes…" /><Link className="action-link" href="/data-lab">Cancel</Link></div></form></section> : null}
              {isCorrecting ? <section className="correction-panel" aria-label={`Correct tracking for ${script.pharmaceuticalName}`}><h3>Correct an accidental lodge</h3><p>These are manual corrections. Choose only the single action that was lodged by mistake; each change takes effect immediately after you acknowledge the warning.</p><div className="correction-options"><form action={undoDoseAction}><h4>Undo one dose</h4><p>Adds back {displayUnits(script.unitsPerDose)} units and recalculates doses and full days.</p><label><input name="confirmCorrection" type="checkbox" value="yes" required /> I have checked that one dose was logged accidentally.</label><SaveMedicationButton idleLabel="Undo 1 dose" pendingLabel="Undoing dose…" /></form><form action={undoDayAction}><h4>Undo one full day</h4><p>Adds back {displayUnits(script.unitsPerDose === null || script.dosesPerDay === null ? null : (Number(script.unitsPerDose) * script.dosesPerDay).toFixed(2))} units for {displayNumber(script.dosesPerDay)} dose(s).</p><label><input name="confirmCorrection" type="checkbox" value="yes" required /> I have checked that one full day was logged accidentally.</label><SaveMedicationButton idleLabel="Undo 1 day" pendingLabel="Undoing day…" /></form><form action={undoRepeatAction}><h4>Undo one filled repeat</h4><p>Removes one script’s units and restores one repeat. If any of that repeat has since been consumed, use Edit to set the actual units instead.</p><label><input name="confirmCorrection" type="checkbox" value="yes" required /> I have checked that one repeat fill was logged accidentally.</label><SaveMedicationButton idleLabel="Undo repeat fill" pendingLabel="Undoing repeat…" /></form></div><Link className="action-link" href="/data-lab">Cancel correction</Link></section> : null}
              {isRemoving ? <section className="remove-confirmation" aria-label={`Remove ${script.pharmaceuticalName}`}><h3>Remove this medication?</h3><p>This removes it from your active list only. Its Preview history is kept, rather than permanently deleting health-related data.</p><form action={archiveAction}><label><input name="confirmArchive" type="checkbox" value="yes" required /> I understand this will archive this medication.</label><div className="edit-actions"><SaveMedicationButton idleLabel="Remove medication" pendingLabel="Removing medication…" /><Link className="action-link" href="/data-lab">Cancel</Link></div></form></section> : null}
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
