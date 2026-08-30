import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";

import {
  addMedication,
  archiveMedication,
  dayConsumed,
  doseConsumed,
  filledRepeat,
  undoDayConsumed,
  undoDoseConsumed,
  undoFilledRepeat,
  updateMedication,
} from "@/app/data-lab/actions";
import { SaveMedicationButton } from "@/app/data-lab/submit-button";
import {
  medicationActivityEvents,
  medications,
  prescriptions,
} from "@/db/schema";
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
const treatmentOptions = [
  ["diabetes", "Diabetes"],
  ["depression_anxiety", "Depression / Anxiety"],
  ["blood_pressure", "Blood Pressure"],
  ["cholesterol", "Cholesterol"],
  ["other", "Other"],
] as const;
const treatmentLabel = (treatment: string | null, other: string | null) =>
  treatment === "other"
    ? other || "Other"
    : (treatmentOptions.find(([value]) => value === treatment)?.[1] ??
      "Not set");
const displayNumber = (value: number | null) =>
  value === null ? "—" : String(value);
const displayUnits = (value: string | null) =>
  value === null ? "—" : Number(value).toFixed(2).replace(/\.00$/, "");
const activityLabel = (eventType: string) =>
  ({
    script_created: "Script created",
    script_updated: "Script edited",
    script_archived: "Medication archived",
    dose_consumed: "Dose consumed",
    day_consumed: "Full day consumed",
    repeat_filled: "Repeat filled",
    dose_reversed: "Dose reversed",
    day_reversed: "Day reversed",
    repeat_reversed: "Repeat fill reversed",
  })[eventType] || eventType;

function ClosePopover({ target }: { target: string }) {
  return (
    <button
      type="button"
      className="modal-close"
      popoverTarget={target}
      popoverTargetAction="hide"
    >
      Cancel
    </button>
  );
}

export default async function DataLabPage({
  searchParams,
}: {
  searchParams: Promise<{ medication?: string }>;
}) {
  if (process.env.VERCEL_ENV === "production")
    return (
      <main className="data-lab-shell">
        <p className="eyebrow">HealthHome</p>
        <h1>Data lab is available in Preview.</h1>
        <p>Production never accepts test data.</p>
      </main>
    );

  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const member = await currentMember();
  if (!member) redirect("/onboarding");
  const { medication } = await searchParams;
  const scripts = await db
    .select({
      prescriptionId: prescriptions.id,
      pharmaceuticalName: medications.name,
      streetName: medications.genericName,
      type: medications.form,
      treatmentOf: medications.treatmentOf,
      treatmentOther: medications.treatmentOther,
      strength: medications.strengthLabel,
      totalUnitsPerScript: prescriptions.totalUnitsPerScript,
      unitsPerDose: prescriptions.unitsPerDose,
      dosesPerDay: prescriptions.dosesPerDay,
      supportsDayConsumption: prescriptions.supportsDayConsumption,
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
    .where(
      and(
        eq(medications.householdId, member.householdId),
        eq(prescriptions.isActive, true),
      ),
    )
    .orderBy(desc(prescriptions.createdAt));
  const activity =
    scripts.length === 0
      ? []
      : await db
          .select({
            prescriptionId: medicationActivityEvents.prescriptionId,
            eventType: medicationActivityEvents.eventType,
            unitsDelta: medicationActivityEvents.unitsDelta,
            repeatsDelta: medicationActivityEvents.repeatsDelta,
            summary: medicationActivityEvents.summary,
            createdAt: medicationActivityEvents.createdAt,
          })
          .from(medicationActivityEvents)
          .where(
            inArray(
              medicationActivityEvents.prescriptionId,
              scripts.map((script) => script.prescriptionId),
            ),
          )
          .orderBy(desc(medicationActivityEvents.createdAt))
          .limit(40);

  return (
    <main className="data-lab-shell">
      <a className="dashboard-link dashboard-link-quiet" href="/app">
        ← Home
      </a>
      <p className="eyebrow">HealthHome · Preview only</p>
      <h1>Medication tracking data lab</h1>
      <p className="data-lab-intro">
        Enter physical units once. HealthHome calculates full doses and full
        days from those values, then keeps them in sync as you record
        consumption or refill a repeat.
      </p>
      {medication === "saved" ? (
        <p className="save-confirmation" role="status">
          Medication script saved. Its tracking card is below.
        </p>
      ) : null}
      <section className="data-lab-form">
        <h2>Add medication script</h2>
        <form
          action={addMedication}
          className="medication-form medication-script-form"
        >
          <fieldset>
            <legend>Medication</legend>
            <label>
              Treatment Of
              <select name="treatmentOf" required defaultValue="">
                <option value="" disabled>
                  Select what this treats
                </option>
                {treatmentOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Treatment details <span>Required if Other</span>
              <input
                name="treatmentOther"
                placeholder="e.g. Migraine prevention"
              />
            </label>
            <label>
              Medication Pharm Name
              <input
                name="pharmaceuticalName"
                required
                placeholder="e.g. Lantus"
              />
            </label>
            <label>
              Medication Street Name
              <input
                name="streetName"
                required
                placeholder="e.g. Insulin glargine"
              />
            </label>
            <label>
              Type
              <select name="type" required>
                {medicationTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Strength
              <input name="strength" required placeholder="e.g. 40 mg" />
            </label>
            <label>
              Total Units Per Script
              <input
                name="totalUnitsPerScript"
                required
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="112"
              />
            </label>
            <label>
              Doses Per Day
              <input
                name="dosesPerDay"
                required
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="1"
              />
            </label>
            <label>
              Repeats Per Script
              <input
                name="repeatsPerScript"
                required
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="5"
              />
            </label>
            <label>
              Script Expiry
              <input name="scriptExpiresOn" type="date" />
            </label>
            <label>
              Refill at <span>Days left</span>
              <input
                name="refillAtDaysLeft"
                required
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="7"
              />
            </label>
          </fieldset>
          <fieldset>
            <legend>Doseing</legend>
            <label>
              Units Per Dose
              <input
                name="unitsPerDose"
                required
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="4"
              />
            </label>
            <label>
              Type
              <select name="doseForm" required>
                {medicationTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dose Strength <span>Optional</span>
              <input name="doseStrength" placeholder="e.g. 160 mg" />
            </label>
            <label>
              <input
                name="supportsDayConsumption"
                type="checkbox"
                value="yes"
                defaultChecked
              />
              Record consumption by full day
              <span>Clear this for medication taken only as needed.</span>
            </label>
            <p className="calculation-hint">
              Frequency is calculated from Doses Per Day. Total doses and full
              days are calculated from the units above.
            </p>
          </fieldset>
          <SaveMedicationButton />
        </form>
      </section>
      {scripts.length === 0 ? (
        <section className="data-lab-empty">
          <h2>No medication scripts yet</h2>
          <p>
            Save one above to test the units, doses, days and refill behaviour.
          </p>
        </section>
      ) : (
        <section className="script-list" aria-label="Medication scripts">
          {scripts.map((script) => {
            const doseAction = doseConsumed.bind(null, script.prescriptionId);
            const dayAction = dayConsumed.bind(null, script.prescriptionId);
            const repeatAction = filledRepeat.bind(null, script.prescriptionId);
            const updateAction = updateMedication.bind(
              null,
              script.prescriptionId,
            );
            const archiveAction = archiveMedication.bind(
              null,
              script.prescriptionId,
            );
            const undoDoseAction = undoDoseConsumed.bind(
              null,
              script.prescriptionId,
            );
            const undoDayAction = undoDayConsumed.bind(
              null,
              script.prescriptionId,
            );
            const undoRepeatAction = undoFilledRepeat.bind(
              null,
              script.prescriptionId,
            );
            const ids = {
              edit: `edit-${script.prescriptionId}`,
              remove: `remove-${script.prescriptionId}`,
              correct: `correct-${script.prescriptionId}`,
              dose: `dose-${script.prescriptionId}`,
              day: `day-${script.prescriptionId}`,
              repeat: `repeat-${script.prescriptionId}`,
            };
            const recentActivity = activity
              .filter((event) => event.prescriptionId === script.prescriptionId)
              .slice(0, 5);
            const needsRefill =
              script.refillAtDaysLeft !== null &&
              script.daysLeft !== null &&
              script.daysLeft <= script.refillAtDaysLeft;
            return (
              <article className="script-card" key={script.prescriptionId}>
                <header>
                  <div>
                    <p className="eyebrow">{script.type}</p>
                    <h2>{script.pharmaceuticalName}</h2>
                    <p>
                      Treatment:{" "}
                      {treatmentLabel(
                        script.treatmentOf,
                        script.treatmentOther,
                      )}
                    </p>
                    <p>
                      {script.streetName || "No street name"} ·{" "}
                      {script.strength || "Strength not set"}
                    </p>
                  </div>
                  <div className="script-card-actions">
                    <span
                      className={
                        needsRefill ? "status status-warning" : "status"
                      }
                    >
                      {needsRefill ? "Refill due" : "Tracking"}
                    </span>
                    <button
                      type="button"
                      className="action-button"
                      popoverTarget={ids.edit}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      popoverTarget={ids.correct}
                    >
                      Correct / undo
                    </button>
                    <button
                      type="button"
                      className="action-button action-button-danger"
                      popoverTarget={ids.remove}
                    >
                      Remove
                    </button>
                  </div>
                </header>
                <div id={ids.edit} popover="auto" className="medication-modal">
                  <div className="medication-modal-heading">
                    <div>
                      <p className="eyebrow">Edit</p>
                      <h3>{script.pharmaceuticalName}</h3>
                      <p>
                        Set actual stock and HealthHome recalculates tracking.
                      </p>
                    </div>
                    <ClosePopover target={ids.edit} />
                  </div>
                  <form
                    action={updateAction}
                    className="medication-form medication-script-form modal-form"
                  >
                    <fieldset>
                      <legend>Medication</legend>
                      <label>
                        Treatment Of
                        <select
                          name="treatmentOf"
                          required
                          defaultValue={script.treatmentOf || ""}
                        >
                          <option value="" disabled>
                            Select what this treats
                          </option>
                          {treatmentOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Treatment details <span>Required if Other</span>
                        <input
                          name="treatmentOther"
                          defaultValue={script.treatmentOther || ""}
                        />
                      </label>
                      <label>
                        Medication Pharm Name
                        <input
                          name="pharmaceuticalName"
                          required
                          defaultValue={script.pharmaceuticalName}
                        />
                      </label>
                      <label>
                        Medication Street Name
                        <input
                          name="streetName"
                          required
                          defaultValue={script.streetName || ""}
                        />
                      </label>
                      <label>
                        Type
                        <select name="type" required defaultValue={script.type}>
                          {medicationTypes.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Strength
                        <input
                          name="strength"
                          required
                          defaultValue={script.strength || ""}
                        />
                      </label>
                      <label>
                        Total Units Per Script
                        <input
                          name="totalUnitsPerScript"
                          required
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          defaultValue={script.totalUnitsPerScript || ""}
                        />
                      </label>
                      <label>
                        Doses Per Day
                        <input
                          name="dosesPerDay"
                          required
                          inputMode="numeric"
                          min="1"
                          step="1"
                          defaultValue={script.dosesPerDay ?? ""}
                        />
                      </label>
                      <label>
                        Repeats Per Script
                        <input
                          name="repeatsPerScript"
                          required
                          inputMode="numeric"
                          min="0"
                          step="1"
                          defaultValue={script.repeatsPerScript ?? ""}
                        />
                      </label>
                      <label>
                        Script Expiry
                        <input
                          name="scriptExpiresOn"
                          type="date"
                          defaultValue={script.scriptExpiresOn || ""}
                        />
                      </label>
                      <label>
                        Refill at <span>Days left</span>
                        <input
                          name="refillAtDaysLeft"
                          required
                          inputMode="numeric"
                          min="0"
                          step="1"
                          defaultValue={script.refillAtDaysLeft ?? ""}
                        />
                      </label>
                    </fieldset>
                    <fieldset>
                      <legend>Doseing and tracking</legend>
                      <label>
                        Units Per Dose
                        <input
                          name="unitsPerDose"
                          required
                          inputMode="decimal"
                          min="0.01"
                          step="0.01"
                          defaultValue={script.unitsPerDose || ""}
                        />
                      </label>
                      <label>
                        Type
                        <select
                          name="doseForm"
                          required
                          defaultValue={script.doseForm || "other"}
                        >
                          {medicationTypes.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Dose Strength <span>Optional</span>
                        <input
                          name="doseStrength"
                          defaultValue={script.doseStrength || ""}
                        />
                      </label>
                      <label>
                        <input
                          name="supportsDayConsumption"
                          type="checkbox"
                          value="yes"
                          defaultChecked={script.supportsDayConsumption}
                        />
                        Record consumption by full day
                        <span>
                          Clear this for medication taken only as needed.
                        </span>
                      </label>
                      <label>
                        Units Left <span>Actual current stock</span>
                        <input
                          name="unitsLeft"
                          required
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          defaultValue={script.unitsLeft || "0"}
                        />
                      </label>
                      <label>
                        Repeats Left
                        <input
                          name="repeatsLeft"
                          required
                          inputMode="numeric"
                          min="0"
                          step="1"
                          defaultValue={script.repeatsLeft ?? 0}
                        />
                      </label>
                    </fieldset>
                    <div className="modal-actions">
                      <SaveMedicationButton
                        idleLabel="Save changes"
                        pendingLabel="Saving changes…"
                      />
                      <ClosePopover target={ids.edit} />
                    </div>
                  </form>
                </div>
                <div
                  id={ids.remove}
                  popover="auto"
                  className="medication-modal modal-warning"
                >
                  <div className="medication-modal-heading">
                    <div>
                      <p className="eyebrow">Remove</p>
                      <h3>Remove {script.pharmaceuticalName}?</h3>
                      <p>
                        This archives the Preview record rather than permanently
                        deleting health data.
                      </p>
                    </div>
                    <ClosePopover target={ids.remove} />
                  </div>
                  <form action={archiveAction} className="confirmation-form">
                    <label>
                      <input
                        name="confirmArchive"
                        type="checkbox"
                        value="yes"
                        required
                      />{" "}
                      I understand this will remove the medication from my
                      active list.
                    </label>
                    <div className="modal-actions">
                      <SaveMedicationButton
                        idleLabel="Remove medication"
                        pendingLabel="Removing medication…"
                      />
                      <ClosePopover target={ids.remove} />
                    </div>
                  </form>
                </div>
                <div
                  id={ids.correct}
                  popover="auto"
                  className="medication-modal modal-warning"
                >
                  <div className="medication-modal-heading">
                    <div>
                      <p className="eyebrow">Correct / undo</p>
                      <h3>Correct an accidental lodge</h3>
                      <p>
                        Choose only one mistaken action. Every correction needs
                        acknowledgement before it changes tracking.
                      </p>
                    </div>
                    <ClosePopover target={ids.correct} />
                  </div>
                  <div className="correction-options modal-correction-options">
                    <form action={undoDoseAction}>
                      <h4>Undo one dose</h4>
                      <p>
                        Adds back {displayUnits(script.unitsPerDose)} units.
                      </p>
                      <label>
                        <input
                          name="confirmCorrection"
                          type="checkbox"
                          value="yes"
                          required
                        />{" "}
                        One dose was logged accidentally.
                      </label>
                      <SaveMedicationButton
                        idleLabel="Undo 1 dose"
                        pendingLabel="Undoing dose…"
                      />
                    </form>
                    {script.supportsDayConsumption ? (
                      <form action={undoDayAction}>
                        <h4>Undo one full day</h4>
                        <p>
                          Adds back{" "}
                          {displayUnits(
                            script.unitsPerDose === null ||
                              script.dosesPerDay === null
                              ? null
                              : (
                                  Number(script.unitsPerDose) *
                                  script.dosesPerDay
                                ).toFixed(2),
                          )}{" "}
                          units.
                        </p>
                        <label>
                          <input
                            name="confirmCorrection"
                            type="checkbox"
                            value="yes"
                            required
                          />{" "}
                          One full day was logged accidentally.
                        </label>
                        <SaveMedicationButton
                          idleLabel="Undo 1 day"
                          pendingLabel="Undoing day…"
                        />
                      </form>
                    ) : null}
                    <form action={undoRepeatAction}>
                      <h4>Undo repeat fill</h4>
                      <p>Restores one repeat and removes one script’s units.</p>
                      <label>
                        <input
                          name="confirmCorrection"
                          type="checkbox"
                          value="yes"
                          required
                        />{" "}
                        One repeat fill was logged accidentally.
                      </label>
                      <SaveMedicationButton
                        idleLabel="Undo repeat fill"
                        pendingLabel="Undoing repeat…"
                      />
                    </form>
                  </div>
                </div>
                <dl className="script-details">
                  <div>
                    <dt>Total units</dt>
                    <dd>{displayUnits(script.totalUnitsPerScript)}</dd>
                  </div>
                  <div>
                    <dt>Units per dose</dt>
                    <dd>{displayUnits(script.unitsPerDose)}</dd>
                  </div>
                  <div>
                    <dt>Doses per day</dt>
                    <dd>{displayNumber(script.dosesPerDay)}</dd>
                  </div>
                  <div>
                    <dt>Total doses</dt>
                    <dd>{displayNumber(script.totalDosesPerScript)}</dd>
                  </div>
                  <div>
                    <dt>Total full days</dt>
                    <dd>{displayNumber(script.totalDaysPerScript)}</dd>
                  </div>
                  <div>
                    <dt>Repeats per script</dt>
                    <dd>{displayNumber(script.repeatsPerScript)}</dd>
                  </div>
                  <div>
                    <dt>Script expiry</dt>
                    <dd>{script.scriptExpiresOn || "—"}</dd>
                  </div>
                  <div>
                    <dt>Refill at</dt>
                    <dd>{displayNumber(script.refillAtDaysLeft)} days left</dd>
                  </div>
                </dl>
                <section className="dosing-section">
                  <h3>Doseing</h3>
                  <p>
                    {displayUnits(script.unitsPerDose)}{" "}
                    {script.doseForm || "units"}
                    {script.doseStrength ? ` · ${script.doseStrength}` : ""}
                  </p>
                  <small>{script.frequency || "Frequency not set"}</small>
                </section>
                <section className="tracking-section">
                  <h3>Tracking</h3>
                  <div className="tracking-grid tracking-grid-four">
                    <div>
                      <span>Units Left</span>
                      <strong>{displayUnits(script.unitsLeft)}</strong>
                    </div>
                    <div>
                      <span>Doses Left</span>
                      <strong>{displayNumber(script.dosesLeft)}</strong>
                    </div>
                    <div>
                      <span>Days Left</span>
                      <strong>{displayNumber(script.daysLeft)}</strong>
                    </div>
                    <div>
                      <span>Repeats Left</span>
                      <strong>{displayNumber(script.repeatsLeft)}</strong>
                    </div>
                  </div>
                  <p className="tracking-note">
                    Each action opens a confirmation pop-up so stock cannot
                    change by a stray click.
                  </p>
                  <div className="tracking-actions">
                    <button type="button" popoverTarget={ids.dose}>
                      Dose Consumed
                    </button>
                    {script.supportsDayConsumption ? (
                      <button type="button" popoverTarget={ids.day}>
                        Day Consumed
                      </button>
                    ) : null}
                    <button type="button" popoverTarget={ids.repeat}>
                      Filled Repeat
                    </button>
                  </div>
                </section>
                <section className="activity-history">
                  <div>
                    <p className="eyebrow">Activity history</p>
                    <h3>Recent changes</h3>
                  </div>
                  {recentActivity.length === 0 ? (
                    <p>
                      No tracked actions yet. New medication actions will appear
                      here.
                    </p>
                  ) : (
                    <ol>
                      {recentActivity.map((event) => (
                        <li
                          key={`${event.eventType}-${event.createdAt.toISOString()}`}
                        >
                          <div>
                            <strong>{activityLabel(event.eventType)}</strong>
                            <span>{event.summary}</span>
                          </div>
                          <small>
                            {event.createdAt.toLocaleString("en-AU", {
                              day: "numeric",
                              month: "short",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {Number(event.unitsDelta) !== 0
                              ? ` · ${Number(event.unitsDelta) > 0 ? "+" : ""}${displayUnits(event.unitsDelta)} units`
                              : ""}
                            {event.repeatsDelta !== 0
                              ? ` · ${event.repeatsDelta > 0 ? "+" : ""}${event.repeatsDelta} repeat${Math.abs(event.repeatsDelta) === 1 ? "" : "s"}`
                              : ""}
                          </small>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                <div
                  id={ids.dose}
                  popover="auto"
                  className="medication-modal modal-action-confirm"
                >
                  <div className="medication-modal-heading">
                    <div>
                      <p className="eyebrow">Confirm</p>
                      <h3>Record one dose?</h3>
                      <p>
                        This removes {displayUnits(script.unitsPerDose)} units
                        from tracking.
                      </p>
                    </div>
                    <ClosePopover target={ids.dose} />
                  </div>
                  <form action={doseAction} className="confirmation-form">
                    <div className="modal-actions">
                      <SaveMedicationButton
                        idleLabel="Record dose"
                        pendingLabel="Recording dose…"
                      />
                      <ClosePopover target={ids.dose} />
                    </div>
                  </form>
                </div>
                {script.supportsDayConsumption ? (
                  <div
                    id={ids.day}
                    popover="auto"
                    className="medication-modal modal-action-confirm"
                  >
                    <div className="medication-modal-heading">
                      <div>
                        <p className="eyebrow">Confirm</p>
                        <h3>Record one full day?</h3>
                        <p>
                          This removes all {displayNumber(script.dosesPerDay)}{" "}
                          dose(s) for today.
                        </p>
                      </div>
                      <ClosePopover target={ids.day} />
                    </div>
                    <form action={dayAction} className="confirmation-form">
                      <div className="modal-actions">
                        <SaveMedicationButton
                          idleLabel="Record day"
                          pendingLabel="Recording day…"
                        />
                        <ClosePopover target={ids.day} />
                      </div>
                    </form>
                  </div>
                ) : null}
                <div
                  id={ids.repeat}
                  popover="auto"
                  className="medication-modal modal-action-confirm"
                >
                  <div className="medication-modal-heading">
                    <div>
                      <p className="eyebrow">Confirm</p>
                      <h3>Record a filled repeat?</h3>
                      <p>
                        This adds {displayUnits(script.totalUnitsPerScript)}{" "}
                        units and uses one repeat.
                      </p>
                    </div>
                    <ClosePopover target={ids.repeat} />
                  </div>
                  <form action={repeatAction} className="confirmation-form">
                    <div className="modal-actions">
                      <SaveMedicationButton
                        idleLabel="Record repeat fill"
                        pendingLabel="Recording repeat…"
                      />
                      <ClosePopover target={ids.repeat} />
                    </div>
                  </form>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
