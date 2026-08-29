"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inventoryEvents, medicationStock, medications, prescriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember } from "@/lib/household";

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

function positiveQuantity(formData: FormData, name: string) {
  const value = Number(requiredText(formData, name));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
  return value.toFixed(2);
}

export async function addMedication(formData: FormData) {
  const member = await previewMember();
  const name = requiredText(formData, "name");
  const unit = requiredText(formData, "unit");
  const initialQuantity = positiveQuantity(formData, "initialQuantity");
  const reorderAtQuantity = positiveQuantity(formData, "reorderAtQuantity");
  const targetQuantity = positiveQuantity(formData, "targetQuantity");
  const strengthValue = optionalText(formData, "strengthValue");
  const doseAmount = optionalText(formData, "doseAmount");
  const repeats = optionalText(formData, "repeatsRemaining");
  const repeatsRemaining = repeats ? Number(repeats) : null;

  if (repeatsRemaining !== null && (!Number.isInteger(repeatsRemaining) || repeatsRemaining < 0)) {
    throw new Error("repeatsRemaining must be a whole number.");
  }

  await db.transaction(async (tx) => {
    const [medication] = await tx.insert(medications).values({
      householdId: member.householdId,
      name,
      form: "tablet",
      strengthValue: strengthValue ? positiveQuantity(formData, "strengthValue") : null,
      strengthUnit: optionalText(formData, "strengthUnit"),
      notes: "Preview test data only. Not clinical advice.",
    }).returning({ id: medications.id });
    const [stock] = await tx.insert(medicationStock).values({
      medicationId: medication.id,
      unit,
      reorderAtQuantity,
      targetQuantity,
    }).returning({ id: medicationStock.id });
    await tx.insert(inventoryEvents).values({
      stockId: stock.id,
      eventType: "received",
      quantityDelta: initialQuantity,
      note: "Initial Preview stock",
    });

    if (doseAmount) {
      await tx.insert(prescriptions).values({
        medicationId: medication.id,
        householdMemberId: member.id,
        doseAmount: positiveQuantity(formData, "doseAmount"),
        doseUnit: optionalText(formData, "doseUnit") || unit,
        frequency: optionalText(formData, "frequency"),
        scriptExpiresOn: optionalText(formData, "scriptExpiresOn"),
        repeatsRemaining,
      });
    }
  });

  revalidatePath("/data-lab");
}

export async function logDose(stockId: string, formData: FormData) {
  const member = await previewMember();
  const quantity = positiveQuantity(formData, "quantity");
  const [balance] = await db
    .select({ currentQuantity: sql<string>`coalesce(${medicationStock.openingQuantity} + sum(${inventoryEvents.quantityDelta}), ${medicationStock.openingQuantity})` })
    .from(medicationStock)
    .innerJoin(medications, eq(medicationStock.medicationId, medications.id))
    .leftJoin(inventoryEvents, eq(inventoryEvents.stockId, medicationStock.id))
    .where(and(eq(medicationStock.id, stockId), eq(medications.householdId, member.householdId)))
    .groupBy(medicationStock.id)
    .limit(1);

  if (!balance) throw new Error("Medication stock was not found.");
  if (Number(balance.currentQuantity) < Number(quantity)) throw new Error("A dose cannot reduce Preview stock below zero.");

  await db.insert(inventoryEvents).values({
    stockId,
    eventType: "consumed",
    quantityDelta: `-${quantity}`,
    note: optionalText(formData, "note") || "Preview dose logged",
  });
  revalidatePath("/data-lab");
}
