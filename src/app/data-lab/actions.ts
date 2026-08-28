"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { householdMembers, households, inventoryEvents, medicationStock, medications } from "@/db/schema";

function assertPreviewDataLab() {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("The data lab cannot write to production.");
  }
}

export async function addDemoMedication() {
  assertPreviewDataLab();

  await db.transaction(async (tx) => {
    const householdName = "HealthHome preview household";
    const memberAuthUserId = "preview-owner";
    const [existingHousehold] = await tx.select({ id: households.id }).from(households).where(eq(households.name, householdName)).limit(1);
    const householdId = existingHousehold ? existingHousehold.id : (await tx.insert(households).values({ name: householdName }).returning({ id: households.id }))[0].id;
    const [existingMember] = await tx.select({ id: householdMembers.id }).from(householdMembers).where(eq(householdMembers.authUserId, memberAuthUserId)).limit(1);

    if (!existingMember) {
      await tx.insert(householdMembers).values({ householdId, authUserId: memberAuthUserId, displayName: "Preview owner", role: "owner" });
    }

    const suffix = new Date().toISOString().slice(11, 19);
    const [medication] = await tx.insert(medications).values({ householdId, name: "Demo medication " + suffix, form: "tablet", strengthValue: "10", strengthUnit: "mg", notes: "Synthetic preview data only. Not clinical data." }).returning({ id: medications.id });
    const [stock] = await tx.insert(medicationStock).values({ medicationId: medication.id, unit: "tablets", reorderAtQuantity: "14", targetQuantity: "56" }).returning({ id: medicationStock.id });
    await tx.insert(inventoryEvents).values({ stockId: stock.id, eventType: "received", quantityDelta: "56", note: "Synthetic preview receipt" });
  });

  revalidatePath("/data-lab");
}
