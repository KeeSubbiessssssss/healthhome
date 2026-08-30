"use server";

import { and, desc, eq, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  dexcomConnections,
  glucoseReadings,
  medicationActivityEvents,
  medicationDoseLogs,
  medications,
  prescriptions,
} from "@/db/schema";
import { db } from "@/lib/db";
import { syncDexcomConnection } from "@/lib/dexcom-sync";
import { currentMember } from "@/lib/household";

const medicationForms = [
  "tablet",
  "injection",
  "aerosol",
  "liquid",
  "cream",
  "other",
] as const;
const medicationTreatments = [
  "diabetes",
  "depression_anxiety",
  "blood_pressure",
  "cholesterol",
  "other",
] as const;

function assertPreviewDataLab() {
  if (process.env.VERCEL_ENV === "production")
    throw new Error("The data lab cannot write to production.");
}

async function previewMember() {
  assertPreviewDataLab();
  const member = await currentMember();
  if (!member)
    throw new Error(
      "Sign in and complete household setup before changing medication data.",
    );
  return member;
}

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is required.`);
  return value.trim();
}

function optionalText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function wholeNumber(formData: FormData, name: string, allowZero = false) {
  const value = Number(requiredText(formData, name));
  if (!Number.isInteger(value) || value < 0 || (!allowZero && value === 0))
    throw new Error(
      `${name} must be a whole number${allowZero ? " of zero or more" : " greater than zero"}.`,
    );
  return value;
}

function positiveDecimal(formData: FormData, name: string) {
  const value = Number(requiredText(formData, name));
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be greater than zero.`);
  return value.toFixed(2);
}

function nonNegativeDecimal(formData: FormData, name: string) {
  const value = Number(requiredText(formData, name));
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be zero or greater.`);
  return value.toFixed(2);
}

function medicationForm(formData: FormData, name: string) {
  const value = requiredText(formData, name);
  if (!medicationForms.includes(value as (typeof medicationForms)[number]))
    throw new Error(`${name} is not a supported medication type.`);
  return value as (typeof medicationForms)[number];
}

function medicationTreatment(formData: FormData) {
  const value = requiredText(formData, "treatmentOf");
  if (
    !medicationTreatments.includes(
      value as (typeof medicationTreatments)[number],
    )
  )
    throw new Error("treatmentOf is not supported.");
  const treatmentOf = value as (typeof medicationTreatments)[number];
  const treatmentOther = optionalText(formData, "treatmentOther");
  if (treatmentOf === "other" && !treatmentOther)
    throw new Error("Please describe what this medication treats.");
  return {
    treatmentOf,
    treatmentOther: treatmentOf === "other" ? treatmentOther : null,
  };
}

function trackingFromUnits(
  unitsLeft: number,
  unitsPerDose: number | null,
  dosesPerDay: number | null,
) {
  const safeUnits = Math.max(0, unitsLeft);
  if (!unitsPerDose || !dosesPerDay)
    return { unitsLeft: safeUnits.toFixed(2), dosesLeft: null, daysLeft: null };
  const dosesLeft = Math.floor((safeUnits + Number.EPSILON) / unitsPerDose);
  const daysLeft = Math.floor(dosesLeft / dosesPerDay);
  return { unitsLeft: safeUnits.toFixed(2), dosesLeft, daysLeft };
}

async function ownedPrescription(prescriptionId: string) {
  const member = await previewMember();
  const [prescription] = await db
    .select({
      id: prescriptions.id,
      form: medications.form,
      totalUnitsPerScript: prescriptions.totalUnitsPerScript,
      unitsPerDose: prescriptions.unitsPerDose,
      dosesPerDay: prescriptions.dosesPerDay,
      supportsDayConsumption: prescriptions.supportsDayConsumption,
      tracksBslAtDose: prescriptions.tracksBslAtDose,
      unitsLeft: prescriptions.unitsLeft,
      repeatsRemaining: prescriptions.repeatsRemaining,
      repeatsAuthorized: prescriptions.repeatsAuthorized,
    })
    .from(prescriptions)
    .innerJoin(medications, eq(prescriptions.medicationId, medications.id))
    .where(
      and(
        eq(prescriptions.id, prescriptionId),
        eq(medications.householdId, member.householdId),
        eq(prescriptions.isActive, true),
      ),
    )
    .limit(1);
  if (!prescription) throw new Error("Medication script was not found.");
  const { totalUnitsPerScript, unitsPerDose, dosesPerDay, unitsLeft } =
    prescription;
  if (totalUnitsPerScript === null || unitsLeft === null) {
    throw new Error(
      "This script needs the units-based tracking fields before it can be consumed.",
    );
  }
  if (Number(totalUnitsPerScript) <= 0) {
    throw new Error(
      "This script needs positive unit and daily-dose values before it can be consumed.",
    );
  }
  return {
    ...prescription,
    memberId: member.id,
    totalUnitsPerScript,
    unitsPerDose,
    dosesPerDay,
    unitsLeft,
  };
}

function assertCorrectionConfirmed(formData: FormData) {
  if (formData.get("confirmCorrection") !== "yes")
    throw new Error(
      "Confirm the correction before changing medication tracking.",
    );
}

async function ownedMedicationScript(prescriptionId: string) {
  const member = await previewMember();
  const [script] = await db
    .select({
      prescriptionId: prescriptions.id,
      medicationId: prescriptions.medicationId,
    })
    .from(prescriptions)
    .innerJoin(medications, eq(prescriptions.medicationId, medications.id))
    .where(
      and(
        eq(prescriptions.id, prescriptionId),
        eq(medications.householdId, member.householdId),
        eq(prescriptions.isActive, true),
      ),
    )
    .limit(1);
  if (!script) throw new Error("Medication script was not found.");
  return { ...script, memberId: member.id };
}

async function recordActivity(
  prescriptionId: string,
  memberId: string,
  eventType: typeof medicationActivityEvents.$inferInsert.eventType,
  unitsDelta: string,
  repeatsDelta: number,
  summary: string,
) {
  await db.insert(medicationActivityEvents).values({
    prescriptionId,
    householdMemberId: memberId,
    eventType,
    unitsDelta,
    repeatsDelta,
    summary,
  });
}

function medicationScriptValues(formData: FormData) {
  const pharmaceuticalName = requiredText(formData, "pharmaceuticalName");
  const streetName = requiredText(formData, "streetName");
  const type = medicationForm(formData, "type");
  const isInjection = type === "injection";
  const treatment = medicationTreatment(formData);
  const strength = requiredText(formData, "strength");
  const totalUnitsPerScript = positiveDecimal(formData, "totalUnitsPerScript");
  const unitsPerDose = isInjection
    ? null
    : positiveDecimal(formData, "unitsPerDose");
  const dosesPerDay = isInjection ? null : wholeNumber(formData, "dosesPerDay");
  const repeatsPerScript = wholeNumber(formData, "repeatsPerScript", true);
  const refillAtDaysLeft = isInjection
    ? null
    : wholeNumber(formData, "refillAtDaysLeft", true);
  const refillAtUnitsLeft = isInjection
    ? positiveDecimal(formData, "refillAtUnitsLeft")
    : null;
  const doseForm = isInjection
    ? "injection"
    : medicationForm(formData, "doseForm");
  const doseStrength = optionalText(formData, "doseStrength");
  const scriptExpiresOn = optionalText(formData, "scriptExpiresOn");
  const supportsDayConsumption =
    !isInjection && formData.get("supportsDayConsumption") === "yes";
  const tracksBslAtDose = formData.get("tracksBslAtDose") === "yes";
  const frequency = isInjection
    ? "Individual doses logged as used"
    : `${dosesPerDay} ${dosesPerDay === 1 ? "dose" : "doses"} per day`;
  return {
    pharmaceuticalName,
    streetName,
    type,
    ...treatment,
    strength,
    totalUnitsPerScript,
    unitsPerDose,
    dosesPerDay,
    repeatsPerScript,
    refillAtDaysLeft,
    refillAtUnitsLeft,
    doseForm,
    doseStrength,
    scriptExpiresOn,
    supportsDayConsumption,
    tracksBslAtDose,
    frequency,
  };
}

export async function addMedication(formData: FormData) {
  const member = await previewMember();
  const values = medicationScriptValues(formData);
  const tracking = trackingFromUnits(
    Number(values.totalUnitsPerScript),
    values.unitsPerDose === null ? null : Number(values.unitsPerDose),
    values.dosesPerDay,
  );
  if (
    values.dosesPerDay &&
    (tracking.dosesLeft === 0 || tracking.daysLeft === 0)
  )
    throw new Error(
      "Total units must cover at least one full day at the chosen dose and doses per day.",
    );

  await db.transaction(async (tx) => {
    const [medication] = await tx
      .insert(medications)
      .values({
        householdId: member.householdId,
        name: values.pharmaceuticalName,
        genericName: values.streetName,
        form: values.type,
        treatmentOf: values.treatmentOf,
        treatmentOther: values.treatmentOther,
        strengthLabel: values.strength,
        notes: "Preview test data only. Not clinical advice.",
      })
      .returning({ id: medications.id });
    const [prescription] = await tx
      .insert(prescriptions)
      .values({
        medicationId: medication.id,
        householdMemberId: member.id,
        doseAmount: values.unitsPerDose,
        doseForm: values.doseForm,
        doseStrengthLabel: values.doseStrength,
        frequency: values.frequency,
        scriptExpiresOn: values.scriptExpiresOn,
        totalUnitsPerScript: values.totalUnitsPerScript,
        unitsPerDose: values.unitsPerDose,
        dosesPerDay: values.dosesPerDay,
        supportsDayConsumption: values.supportsDayConsumption,
        tracksBslAtDose: values.tracksBslAtDose,
        unitsLeft: tracking.unitsLeft,
        totalDosesPerScript: tracking.dosesLeft,
        totalDaysPerScript: tracking.daysLeft,
        refillAtDaysLeft: values.refillAtDaysLeft,
        refillAtUnitsLeft: values.refillAtUnitsLeft,
        dosesLeft: tracking.dosesLeft,
        daysLeft: tracking.daysLeft,
        repeatsAuthorized: values.repeatsPerScript,
        repeatsRemaining: values.repeatsPerScript,
      })
      .returning({ id: prescriptions.id });
    await tx.insert(medicationActivityEvents).values({
      prescriptionId: prescription.id,
      householdMemberId: member.id,
      eventType: "script_created",
      unitsDelta: tracking.unitsLeft,
      repeatsDelta: values.repeatsPerScript,
      summary: "Medication script created",
    });
  });

  revalidatePath("/data-lab");
  redirect("/data-lab?medication=saved");
}

export async function updateMedication(
  prescriptionId: string,
  formData: FormData,
) {
  const script = await ownedMedicationScript(prescriptionId);
  const values = medicationScriptValues(formData);
  const unitsLeft = nonNegativeDecimal(formData, "unitsLeft");
  const repeatsLeft = wholeNumber(formData, "repeatsLeft", true);
  if (repeatsLeft > values.repeatsPerScript)
    throw new Error("Repeats left cannot be higher than repeats per script.");
  const tracking = trackingFromUnits(
    Number(unitsLeft),
    values.unitsPerDose === null ? null : Number(values.unitsPerDose),
    values.dosesPerDay,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(medications)
      .set({
        name: values.pharmaceuticalName,
        genericName: values.streetName,
        form: values.type,
        treatmentOf: values.treatmentOf,
        treatmentOther: values.treatmentOther,
        strengthLabel: values.strength,
        updatedAt: new Date(),
      })
      .where(eq(medications.id, script.medicationId));
    await tx
      .update(prescriptions)
      .set({
        doseAmount: values.unitsPerDose,
        doseForm: values.doseForm,
        doseStrengthLabel: values.doseStrength,
        frequency: values.frequency,
        scriptExpiresOn: values.scriptExpiresOn,
        totalUnitsPerScript: values.totalUnitsPerScript,
        unitsPerDose: values.unitsPerDose,
        dosesPerDay: values.dosesPerDay,
        supportsDayConsumption: values.supportsDayConsumption,
        tracksBslAtDose: values.tracksBslAtDose,
        unitsLeft: tracking.unitsLeft,
        totalDosesPerScript: tracking.dosesLeft,
        totalDaysPerScript: tracking.daysLeft,
        refillAtDaysLeft: values.refillAtDaysLeft,
        refillAtUnitsLeft: values.refillAtUnitsLeft,
        dosesLeft: tracking.dosesLeft,
        daysLeft: tracking.daysLeft,
        repeatsAuthorized: values.repeatsPerScript,
        repeatsRemaining: repeatsLeft,
        updatedAt: new Date(),
      })
      .where(eq(prescriptions.id, script.prescriptionId));
  });

  await recordActivity(
    script.prescriptionId,
    script.memberId,
    "script_updated",
    "0",
    0,
    "Medication script edited",
  );
  revalidatePath("/data-lab");
}

export async function archiveMedication(
  prescriptionId: string,
  formData: FormData,
) {
  if (formData.get("confirmArchive") !== "yes")
    throw new Error("Confirm removal before archiving this medication.");
  const script = await ownedMedicationScript(prescriptionId);
  await db
    .update(prescriptions)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(prescriptions.id, script.prescriptionId));
  await recordActivity(
    script.prescriptionId,
    script.memberId,
    "script_archived",
    "0",
    0,
    "Medication archived",
  );
  revalidatePath("/data-lab");
}

export async function doseConsumed(prescriptionId: string, formData: FormData) {
  const prescription = await ownedPrescription(prescriptionId);
  const unitsLeft = Number(prescription.unitsLeft);
  const unitsPerDose =
    prescription.form === "injection"
      ? Number(positiveDecimal(formData, "unitsConsumed"))
      : Number(prescription.unitsPerDose);
  if (!Number.isFinite(unitsPerDose) || unitsPerDose <= 0)
    throw new Error(
      "This medication needs a valid units-per-dose value before it can be consumed.",
    );
  if (unitsLeft + Number.EPSILON < unitsPerDose)
    throw new Error("There are not enough units left for a full dose.");
  const occurredAt = new Date(requiredText(formData, "occurredAt"));
  if (Number.isNaN(occurredAt.getTime()))
    throw new Error("Choose a valid dose time.");
  let bslMgDl: number | null = null;
  let bslSource: "dexcom" | "manual" | null = null;
  let glucoseReadingId: string | null = null;
  if (prescription.tracksBslAtDose) {
    const member = await previewMember();
    const [connection] = await db
      .select()
      .from(dexcomConnections)
      .where(eq(dexcomConnections.householdMemberId, member.id))
      .limit(1);
    const suppliedReadingId = optionalText(formData, "dexcomReadingId");
    if (connection?.status === "connected" && !suppliedReadingId)
      await syncDexcomConnection(connection.id);
    const manualBsl = optionalText(formData, "manualBslMgDl");
    if (manualBsl) {
      bslMgDl = Math.round(Number(manualBsl));
      if (!Number.isFinite(bslMgDl) || bslMgDl <= 0)
        throw new Error("Manual BSL must be a positive mg/dL value.");
      bslSource = "manual";
    } else if (connection) {
      const [reading] = await db
        .select({
          id: glucoseReadings.id,
          valueMgDl: glucoseReadings.valueMgDl,
        })
        .from(glucoseReadings)
        .where(
          suppliedReadingId
            ? and(
                eq(glucoseReadings.connectionId, connection.id),
                eq(glucoseReadings.id, suppliedReadingId),
              )
            : and(
                eq(glucoseReadings.connectionId, connection.id),
                lte(glucoseReadings.recordedAt, occurredAt),
              ),
        )
        .orderBy(desc(glucoseReadings.recordedAt))
        .limit(1);
      if (!reading)
        throw new Error(
          "No synced Dexcom reading is available for that time. Enter the BSL manually to log this dose.",
        );
      bslMgDl = reading.valueMgDl;
      bslSource = "dexcom";
      glucoseReadingId = reading.id;
    } else
      throw new Error(
        "Connect Dexcom or enter the BSL manually before logging this dose.",
      );
  }
  const tracking = trackingFromUnits(
    unitsLeft - unitsPerDose,
    prescription.form === "injection" ? null : unitsPerDose,
    prescription.dosesPerDay,
  );
  await db
    .update(prescriptions)
    .set({ ...tracking, updatedAt: new Date() })
    .where(eq(prescriptions.id, prescription.id));
  await recordActivity(
    prescription.id,
    prescription.memberId,
    "dose_consumed",
    (-unitsPerDose).toFixed(2),
    0,
    "One dose consumed",
  );
  if (prescription.form === "injection" || prescription.tracksBslAtDose)
    await db.insert(medicationDoseLogs).values({
      prescriptionId: prescription.id,
      householdMemberId: prescription.memberId,
      glucoseReadingId,
      unitsConsumed: unitsPerDose.toFixed(2),
      bslMgDl,
      bslSource,
      occurredAt,
    });
  revalidatePath("/data-lab");
  revalidatePath("/app");
}

export async function dayConsumed(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  if (!prescription.supportsDayConsumption)
    throw new Error(
      "This medication is set to be consumed dose-by-dose, not by day.",
    );
  if (prescription.unitsPerDose === null || prescription.dosesPerDay === null)
    throw new Error("This medication does not have a scheduled day dose.");
  const unitsLeft = Number(prescription.unitsLeft);
  const unitsPerDay =
    Number(prescription.unitsPerDose) * prescription.dosesPerDay;
  if (unitsLeft + Number.EPSILON < unitsPerDay)
    throw new Error("There are not enough units left for a full day of doses.");
  const tracking = trackingFromUnits(
    unitsLeft - unitsPerDay,
    Number(prescription.unitsPerDose),
    prescription.dosesPerDay,
  );
  await db
    .update(prescriptions)
    .set({ ...tracking, updatedAt: new Date() })
    .where(eq(prescriptions.id, prescription.id));
  await recordActivity(
    prescription.id,
    prescription.memberId,
    "day_consumed",
    (-unitsPerDay).toFixed(2),
    0,
    "One full day consumed",
  );
  revalidatePath("/data-lab");
}

export async function filledRepeat(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  if (!prescription.repeatsRemaining || prescription.repeatsRemaining <= 0)
    throw new Error("There are no repeats left to fill.");
  const tracking = trackingFromUnits(
    Number(prescription.unitsLeft) + Number(prescription.totalUnitsPerScript),
    Number(prescription.unitsPerDose),
    prescription.dosesPerDay,
  );
  await db
    .update(prescriptions)
    .set({
      ...tracking,
      repeatsRemaining: prescription.repeatsRemaining - 1,
      updatedAt: new Date(),
    })
    .where(eq(prescriptions.id, prescription.id));
  await recordActivity(
    prescription.id,
    prescription.memberId,
    "repeat_filled",
    Number(prescription.totalUnitsPerScript).toFixed(2),
    -1,
    "Repeat filled",
  );
  revalidatePath("/data-lab");
}

export async function undoDoseConsumed(
  prescriptionId: string,
  formData: FormData,
) {
  assertCorrectionConfirmed(formData);
  const prescription = await ownedPrescription(prescriptionId);
  const tracking = trackingFromUnits(
    Number(prescription.unitsLeft) + Number(prescription.unitsPerDose),
    Number(prescription.unitsPerDose),
    prescription.dosesPerDay,
  );
  await db
    .update(prescriptions)
    .set({ ...tracking, updatedAt: new Date() })
    .where(eq(prescriptions.id, prescription.id));
  await recordActivity(
    prescription.id,
    prescription.memberId,
    "dose_reversed",
    Number(prescription.unitsPerDose).toFixed(2),
    0,
    "Accidental dose entry reversed",
  );
  revalidatePath("/data-lab");
}

export async function undoDayConsumed(
  prescriptionId: string,
  formData: FormData,
) {
  assertCorrectionConfirmed(formData);
  const prescription = await ownedPrescription(prescriptionId);
  if (!prescription.supportsDayConsumption)
    throw new Error(
      "This medication is set to be consumed dose-by-dose, not by day.",
    );
  if (prescription.unitsPerDose === null || prescription.dosesPerDay === null)
    throw new Error("This medication does not have a scheduled day dose.");
  const unitsPerDay =
    Number(prescription.unitsPerDose) * prescription.dosesPerDay;
  const tracking = trackingFromUnits(
    Number(prescription.unitsLeft) + unitsPerDay,
    Number(prescription.unitsPerDose),
    prescription.dosesPerDay,
  );
  await db
    .update(prescriptions)
    .set({ ...tracking, updatedAt: new Date() })
    .where(eq(prescriptions.id, prescription.id));
  await recordActivity(
    prescription.id,
    prescription.memberId,
    "day_reversed",
    unitsPerDay.toFixed(2),
    0,
    "Accidental day entry reversed",
  );
  revalidatePath("/data-lab");
}

export async function undoFilledRepeat(
  prescriptionId: string,
  formData: FormData,
) {
  assertCorrectionConfirmed(formData);
  const prescription = await ownedPrescription(prescriptionId);
  if (
    prescription.repeatsAuthorized === null ||
    prescription.repeatsRemaining === null
  )
    throw new Error(
      "This script needs repeat tracking before a filled repeat can be corrected.",
    );
  if (prescription.repeatsRemaining >= prescription.repeatsAuthorized)
    throw new Error("There is no filled repeat available to roll back.");
  const unitsLeftAfterUndo =
    Number(prescription.unitsLeft) - Number(prescription.totalUnitsPerScript);
  if (unitsLeftAfterUndo < -Number.EPSILON) {
    throw new Error(
      "This filled repeat cannot be rolled back because some of its units have already been consumed. Use Edit to set the actual units left instead.",
    );
  }
  const tracking = trackingFromUnits(
    unitsLeftAfterUndo,
    Number(prescription.unitsPerDose),
    prescription.dosesPerDay,
  );
  await db
    .update(prescriptions)
    .set({
      ...tracking,
      repeatsRemaining: prescription.repeatsRemaining + 1,
      updatedAt: new Date(),
    })
    .where(eq(prescriptions.id, prescription.id));
  await recordActivity(
    prescription.id,
    prescription.memberId,
    "repeat_reversed",
    (-Number(prescription.totalUnitsPerScript)).toFixed(2),
    1,
    "Accidental repeat fill reversed",
  );
  revalidatePath("/data-lab");
}
