"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { medications, prescriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember } from "@/lib/household";

const medicationForms = ["tablet", "injection", "aerosol", "liquid", "cream", "other"] as const;

function assertPreviewDataLab() {
  if (process.env.VERCEL_ENV === "production") throw new Error("The data lab cannot write to production.");
}

async function previewMember() {
  assertPreviewDataLab();
  const member = await currentMember();
  if (!member) throw new Error("Sign in and complete household setup before changing medication data.");
  return member;
}

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function optionalText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function wholeNumber(formData: FormData, name: string, allowZero = false) {
  const value = Number(requiredText(formData, name));
  if (!Number.isInteger(value) || value < 0 || (!allowZero && value === 0)) throw new Error(`${name} must be a whole number${allowZero ? " of zero or more" : " greater than zero"}.`);
  return value;
}

function positiveDecimal(formData: FormData, name: string) {
  const value = Number(requiredText(formData, name));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero.`);
  return value.toFixed(2);
}

function medicationForm(formData: FormData, name: string) {
  const value = requiredText(formData, name);
  if (!medicationForms.includes(value as (typeof medicationForms)[number])) throw new Error(`${name} is not a supported medication type.`);
  return value as (typeof medicationForms)[number];
}

function trackingFromUnits(unitsLeft: number, unitsPerDose: number, dosesPerDay: number) {
  const safeUnits = Math.max(0, unitsLeft);
  const dosesLeft = Math.floor((safeUnits + Number.EPSILON) / unitsPerDose);
  const daysLeft = Math.floor(dosesLeft / dosesPerDay);
  return { unitsLeft: safeUnits.toFixed(2), dosesLeft, daysLeft };
}

async function ownedPrescription(prescriptionId: string) {
  const member = await previewMember();
  const [prescription] = await db
    .select({
      id: prescriptions.id,
      totalUnitsPerScript: prescriptions.totalUnitsPerScript,
      unitsPerDose: prescriptions.unitsPerDose,
      dosesPerDay: prescriptions.dosesPerDay,
      unitsLeft: prescriptions.unitsLeft,
      repeatsRemaining: prescriptions.repeatsRemaining,
    })
    .from(prescriptions)
    .innerJoin(medications, eq(prescriptions.medicationId, medications.id))
    .where(and(eq(prescriptions.id, prescriptionId), eq(medications.householdId, member.householdId), eq(prescriptions.isActive, true)))
    .limit(1);
  if (!prescription) throw new Error("Medication script was not found.");
  const { totalUnitsPerScript, unitsPerDose, dosesPerDay, unitsLeft } = prescription;
  if (totalUnitsPerScript === null || unitsPerDose === null || dosesPerDay === null || unitsLeft === null) {
    throw new Error("This script needs the units-based tracking fields before it can be consumed.");
  }
  if (Number(totalUnitsPerScript) <= 0 || Number(unitsPerDose) <= 0 || dosesPerDay <= 0) {
    throw new Error("This script needs positive unit and daily-dose values before it can be consumed.");
  }
  return { ...prescription, totalUnitsPerScript, unitsPerDose, dosesPerDay, unitsLeft };
}

export async function addMedication(formData: FormData) {
  const member = await previewMember();
  const pharmaceuticalName = requiredText(formData, "pharmaceuticalName");
  const streetName = requiredText(formData, "streetName");
  const type = medicationForm(formData, "type");
  const strength = requiredText(formData, "strength");
  const totalUnitsPerScript = positiveDecimal(formData, "totalUnitsPerScript");
  const unitsPerDose = positiveDecimal(formData, "unitsPerDose");
  const dosesPerDay = wholeNumber(formData, "dosesPerDay");
  const repeatsPerScript = wholeNumber(formData, "repeatsPerScript", true);
  const refillAtDaysLeft = wholeNumber(formData, "refillAtDaysLeft", true);
  const doseForm = medicationForm(formData, "doseForm");
  const doseStrength = optionalText(formData, "doseStrength");
  const tracking = trackingFromUnits(Number(totalUnitsPerScript), Number(unitsPerDose), dosesPerDay);
  if (tracking.dosesLeft === 0 || tracking.daysLeft === 0) throw new Error("Total units must cover at least one full day at the chosen dose and doses per day.");
  const frequency = `${dosesPerDay} ${dosesPerDay === 1 ? "dose" : "doses"} per day`;

  await db.transaction(async (tx) => {
    const [medication] = await tx.insert(medications).values({
      householdId: member.householdId,
      name: pharmaceuticalName,
      genericName: streetName,
      form: type,
      strengthLabel: strength,
      notes: "Preview test data only. Not clinical advice.",
    }).returning({ id: medications.id });
    await tx.insert(prescriptions).values({
      medicationId: medication.id,
      householdMemberId: member.id,
      doseAmount: unitsPerDose,
      doseForm,
      doseStrengthLabel: doseStrength,
      frequency,
      scriptExpiresOn: optionalText(formData, "scriptExpiresOn"),
      totalUnitsPerScript,
      unitsPerDose,
      dosesPerDay,
      unitsLeft: tracking.unitsLeft,
      totalDosesPerScript: tracking.dosesLeft,
      totalDaysPerScript: tracking.daysLeft,
      refillAtDaysLeft,
      dosesLeft: tracking.dosesLeft,
      daysLeft: tracking.daysLeft,
      repeatsAuthorized: repeatsPerScript,
      repeatsRemaining: repeatsPerScript,
    });
  });

  revalidatePath("/data-lab");
}

export async function doseConsumed(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  const unitsLeft = Number(prescription.unitsLeft);
  const unitsPerDose = Number(prescription.unitsPerDose);
  if (unitsLeft + Number.EPSILON < unitsPerDose) throw new Error("There are not enough units left for a full dose.");
  const tracking = trackingFromUnits(unitsLeft - unitsPerDose, unitsPerDose, prescription.dosesPerDay);
  await db.update(prescriptions).set({ ...tracking, updatedAt: new Date() }).where(eq(prescriptions.id, prescription.id));
  revalidatePath("/data-lab");
}

export async function dayConsumed(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  const unitsLeft = Number(prescription.unitsLeft);
  const unitsPerDay = Number(prescription.unitsPerDose) * prescription.dosesPerDay;
  if (unitsLeft + Number.EPSILON < unitsPerDay) throw new Error("There are not enough units left for a full day of doses.");
  const tracking = trackingFromUnits(unitsLeft - unitsPerDay, Number(prescription.unitsPerDose), prescription.dosesPerDay);
  await db.update(prescriptions).set({ ...tracking, updatedAt: new Date() }).where(eq(prescriptions.id, prescription.id));
  revalidatePath("/data-lab");
}

export async function filledRepeat(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  if (!prescription.repeatsRemaining || prescription.repeatsRemaining <= 0) throw new Error("There are no repeats left to fill.");
  const tracking = trackingFromUnits(Number(prescription.unitsLeft) + Number(prescription.totalUnitsPerScript), Number(prescription.unitsPerDose), prescription.dosesPerDay);
  await db.update(prescriptions).set({
    ...tracking,
    repeatsRemaining: prescription.repeatsRemaining - 1,
    updatedAt: new Date(),
  }).where(eq(prescriptions.id, prescription.id));
  revalidatePath("/data-lab");
}
