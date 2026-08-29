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

async function ownedPrescription(prescriptionId: string) {
  const member = await previewMember();
  const [prescription] = await db
    .select({
      id: prescriptions.id,
      totalDosesPerScript: prescriptions.totalDosesPerScript,
      totalDaysPerScript: prescriptions.totalDaysPerScript,
      dosesLeft: prescriptions.dosesLeft,
      daysLeft: prescriptions.daysLeft,
      repeatsRemaining: prescriptions.repeatsRemaining,
    })
    .from(prescriptions)
    .innerJoin(medications, eq(prescriptions.medicationId, medications.id))
    .where(and(eq(prescriptions.id, prescriptionId), eq(medications.householdId, member.householdId), eq(prescriptions.isActive, true)))
    .limit(1);
  if (!prescription) throw new Error("Medication script was not found.");
  return prescription;
}

export async function addMedication(formData: FormData) {
  const member = await previewMember();
  const pharmaceuticalName = requiredText(formData, "pharmaceuticalName");
  const streetName = requiredText(formData, "streetName");
  const type = medicationForm(formData, "type");
  const strength = requiredText(formData, "strength");
  const totalDosesPerScript = wholeNumber(formData, "totalDosesPerScript");
  const totalDaysPerScript = wholeNumber(formData, "totalDaysPerScript");
  const repeatsPerScript = wholeNumber(formData, "repeatsPerScript", true);
  const refillAtDaysLeft = wholeNumber(formData, "refillAtDaysLeft", true);
  const doseAmount = positiveDecimal(formData, "doseAmount");
  const doseForm = medicationForm(formData, "doseForm");
  const doseStrength = requiredText(formData, "doseStrength");
  const frequency = requiredText(formData, "frequency");

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
      doseAmount,
      doseForm,
      doseStrengthLabel: doseStrength,
      frequency,
      scriptExpiresOn: optionalText(formData, "scriptExpiresOn"),
      totalDosesPerScript,
      totalDaysPerScript,
      refillAtDaysLeft,
      dosesLeft: totalDosesPerScript,
      daysLeft: totalDaysPerScript,
      repeatsAuthorized: repeatsPerScript,
      repeatsRemaining: repeatsPerScript,
    });
  });

  revalidatePath("/data-lab");
}

export async function doseConsumed(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  if (!prescription.dosesLeft || prescription.dosesLeft <= 0) throw new Error("There are no doses left to consume.");
  await db.update(prescriptions).set({ dosesLeft: prescription.dosesLeft - 1, updatedAt: new Date() }).where(eq(prescriptions.id, prescription.id));
  revalidatePath("/data-lab");
}

export async function dayConsumed(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  if (!prescription.daysLeft || prescription.daysLeft <= 0) throw new Error("There are no days left to consume.");
  await db.update(prescriptions).set({ daysLeft: prescription.daysLeft - 1, updatedAt: new Date() }).where(eq(prescriptions.id, prescription.id));
  revalidatePath("/data-lab");
}

export async function filledRepeat(prescriptionId: string) {
  const prescription = await ownedPrescription(prescriptionId);
  if (!prescription.repeatsRemaining || prescription.repeatsRemaining <= 0) throw new Error("There are no repeats left to fill.");
  if (!prescription.totalDosesPerScript || !prescription.totalDaysPerScript) throw new Error("This script is missing its dose or day totals.");
  await db.update(prescriptions).set({
    dosesLeft: (prescription.dosesLeft || 0) + prescription.totalDosesPerScript,
    daysLeft: (prescription.daysLeft || 0) + prescription.totalDaysPerScript,
    repeatsRemaining: prescription.repeatsRemaining - 1,
    updatedAt: new Date(),
  }).where(eq(prescriptions.id, prescription.id));
  revalidatePath("/data-lab");
}
