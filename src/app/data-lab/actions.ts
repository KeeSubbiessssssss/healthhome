"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { householdMembers, households, inventoryEvents, medicationStock, medications, prescriptions } from "@/db/schema";

function assertPreviewDataLab() { if (process.env.VERCEL_ENV === "production") throw new Error("The data lab cannot write to production."); }
function requiredText(formData: FormData, name: string) { const value = formData.get(name); if (typeof value !== "string" || !value.trim()) throw new Error(name + " is required."); return value.trim(); }
function positiveQuantity(formData: FormData, name: string) { const value = Number(requiredText(formData, name)); if (!Number.isFinite(value) || value <= 0) throw new Error(name + " must be a positive number."); return value.toFixed(2); }

async function previewHouseholdId() {
  const householdName = "HealthHome preview household";
  const [household] = await db.select({ id: households.id }).from(households).where(eq(households.name, householdName)).limit(1);
  const householdId = household ? household.id : (await db.insert(households).values({ name: householdName }).returning({ id: households.id }))[0].id;
  const [member] = await db.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.authUserId, "preview-owner")).limit(1);
  if (!member) await db.insert(householdMembers).values({ householdId, authUserId: "preview-owner", displayName: "Preview owner", role: "owner" });
  return householdId;
}

export async function addMedication(formData: FormData) {
  assertPreviewDataLab();
  const name = requiredText(formData, "name"); const unit = requiredText(formData, "unit");
  const initialQuantity = positiveQuantity(formData, "initialQuantity"); const reorderAtQuantity = positiveQuantity(formData, "reorderAtQuantity"); const targetQuantity = positiveQuantity(formData, "targetQuantity");
  const strengthValue = formData.get("strengthValue"); const doseAmount = formData.get("doseAmount"); const repeats = formData.get("repeatsRemaining");
  const repeatsRemaining = typeof repeats === "string" && repeats.trim() ? Number(repeats) : null;
  if (repeatsRemaining !== null && (!Number.isInteger(repeatsRemaining) || repeatsRemaining < 0)) throw new Error("repeatsRemaining must be a whole number.");
  const householdId = await previewHouseholdId();
  await db.transaction(async (tx) => {
    const [medication] = await tx.insert(medications).values({ householdId, name, form: "tablet", strengthValue: typeof strengthValue === "string" && strengthValue.trim() ? positiveQuantity(formData, "strengthValue") : null, strengthUnit: requiredTextOrNull(formData, "strengthUnit"), notes: "Preview test data only. Not clinical advice." }).returning({ id: medications.id });
    const [stock] = await tx.insert(medicationStock).values({ medicationId: medication.id, unit, reorderAtQuantity, targetQuantity }).returning({ id: medicationStock.id });
    await tx.insert(inventoryEvents).values({ stockId: stock.id, eventType: "received", quantityDelta: initialQuantity, note: "Initial preview stock" });
    if (typeof doseAmount === "string" && doseAmount.trim()) {
      const [member] = await tx.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.authUserId, "preview-owner")).limit(1);
      await tx.insert(prescriptions).values({ medicationId: medication.id, householdMemberId: member.id, doseAmount: positiveQuantity(formData, "doseAmount"), doseUnit: requiredTextOrNull(formData, "doseUnit") || unit, frequency: requiredTextOrNull(formData, "frequency"), scriptExpiresOn: requiredTextOrNull(formData, "scriptExpiresOn"), repeatsRemaining });
    }
  });
  revalidatePath("/data-lab");
}

function requiredTextOrNull(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }

export async function logDose(stockId: string, formData: FormData) {
  assertPreviewDataLab();
  const quantity = positiveQuantity(formData, "quantity");
  const [balance] = await db.select({ currentQuantity: sql<string>`coalesce(${medicationStock.openingQuantity} + sum(${inventoryEvents.quantityDelta}), ${medicationStock.openingQuantity})` }).from(medicationStock).leftJoin(inventoryEvents, eq(inventoryEvents.stockId, medicationStock.id)).where(eq(medicationStock.id, stockId)).groupBy(medicationStock.id).limit(1);
  if (!balance) throw new Error("Medication stock was not found.");
  if (Number(balance.currentQuantity) < Number(quantity)) throw new Error("A dose cannot reduce test stock below zero.");
  await db.insert(inventoryEvents).values({ stockId, eventType: "consumed", quantityDelta: "-" + quantity, note: requiredTextOrNull(formData, "note") || "Preview dose logged" });
  revalidatePath("/data-lab");
}
