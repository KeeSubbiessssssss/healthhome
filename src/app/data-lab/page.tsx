import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { addMedication, logDose } from "@/app/data-lab/actions";
import { householdMembers, inventoryEvents, medicationStock, medications, prescriptions } from "@/db/schema";
import { db } from "@/lib/db";
import { currentMember, currentUser } from "@/lib/household";

export const dynamic = "force-dynamic";

function formatQuantity(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}

export default async function DataLabPage() {
  if (process.env.VERCEL_ENV === "production") {
    return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Data lab is available in Preview.</h1><p>Production never accepts test data.</p></main>;
  }

  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  const member = await currentMember();
  if (!member) redirect("/onboarding");

  const stocks = await db
    .select({ stockId: medicationStock.id, medicationId: medications.id, medicationName: medications.name, unit: medicationStock.unit, openingQuantity: medicationStock.openingQuantity, reorderAtQuantity: medicationStock.reorderAtQuantity, targetQuantity: medicationStock.targetQuantity })
    .from(medicationStock)
    .innerJoin(medications, eq(medicationStock.medicationId, medications.id))
    .where(eq(medications.householdId, member.householdId))
    .orderBy(desc(medications.createdAt));
  const events = await db
    .select({ stockId: inventoryEvents.stockId, quantityDelta: inventoryEvents.quantityDelta })
    .from(inventoryEvents)
    .innerJoin(medicationStock, eq(inventoryEvents.stockId, medicationStock.id))
    .innerJoin(medications, eq(medicationStock.medicationId, medications.id))
    .where(eq(medications.householdId, member.householdId));
  const activePrescriptions = await db
    .select({ medicationId: prescriptions.medicationId, doseAmount: prescriptions.doseAmount, doseUnit: prescriptions.doseUnit, frequency: prescriptions.frequency, repeatsRemaining: prescriptions.repeatsRemaining })
    .from(prescriptions)
    .innerJoin(medications, eq(prescriptions.medicationId, medications.id))
    .innerJoin(householdMembers, eq(prescriptions.householdMemberId, householdMembers.id))
    .where(and(eq(medications.householdId, member.householdId), eq(prescriptions.isActive, true)));
  const inventory = stocks.map((stock) => {
    const delta = events.filter((event) => event.stockId === stock.stockId).reduce((total, event) => total + Number(event.quantityDelta), 0);
    return { ...stock, currentQuantity: Number(stock.openingQuantity) + delta, prescription: activePrescriptions.find((item) => item.medicationId === stock.medicationId) };
  });

  return <main className="data-lab-shell"><p className="eyebrow">HealthHome · Preview only</p><h1>Medication inventory data lab</h1><p className="data-lab-intro">Create your own test medication records, supply, prescription details and dose logs before we design the product UI. Preview data stays isolated from production.</p><section className="data-lab-form"><h2>Add medication and supply</h2><form action={addMedication} className="medication-form"><label>Name<input name="name" required placeholder="e.g. Metformin" /></label><label>Initial supply<input name="initialQuantity" required inputMode="decimal" placeholder="56" /></label><label>Unit<input name="unit" required placeholder="tablets" /></label><label>Refill at<input name="reorderAtQuantity" required inputMode="decimal" placeholder="14" /></label><label>Target supply<input name="targetQuantity" required inputMode="decimal" placeholder="56" /></label><label>Strength (optional)<input name="strengthValue" inputMode="decimal" placeholder="500" /></label><label>Strength unit<input name="strengthUnit" placeholder="mg" /></label><label>Dose amount (optional)<input name="doseAmount" inputMode="decimal" placeholder="1" /></label><label>Dose unit<input name="doseUnit" placeholder="tablet" /></label><label>Frequency<input name="frequency" placeholder="Twice daily" /></label><label>Script expiry<input name="scriptExpiresOn" type="date" /></label><label>Repeats remaining<input name="repeatsRemaining" inputMode="numeric" min="0" step="1" /></label><button type="submit">Save Preview medication</button></form></section>{inventory.length === 0 ? <section className="data-lab-empty"><h2>No medication stock yet</h2><p>Add a test medication to prove the record, inventory total and refill rules.</p></section> : <section className="data-lab-table-wrap"><table><thead><tr><th>Medication</th><th>Current</th><th>Prescription</th><th>Refill at</th><th>Action</th></tr></thead><tbody>{inventory.map((stock) => { const needsRefill = stock.currentQuantity <= Number(stock.reorderAtQuantity); const doseAction = logDose.bind(null, stock.stockId); return <tr key={stock.stockId}><td>{stock.medicationName}</td><td><strong>{formatQuantity(stock.currentQuantity)} {stock.unit}</strong><br /><span className={needsRefill ? "status status-warning" : "status"}>{needsRefill ? "Refill" : "In stock"}</span></td><td>{stock.prescription ? <>{stock.prescription.doseAmount} {stock.prescription.doseUnit || stock.unit}<br /><small>{stock.prescription.frequency || "Frequency not set"}{stock.prescription.repeatsRemaining !== null ? ` · ${stock.prescription.repeatsRemaining} repeats` : ""}</small></> : <small>No prescription recorded</small>}</td><td>{formatQuantity(Number(stock.reorderAtQuantity))} {stock.unit}<br /><small>Target {formatQuantity(Number(stock.targetQuantity))}</small></td><td><form action={doseAction} className="dose-form"><input name="quantity" required inputMode="decimal" placeholder="Dose" aria-label={`Dose quantity for ${stock.medicationName}`} /><input name="note" placeholder="Optional note" aria-label={`Dose note for ${stock.medicationName}`} /><button type="submit">Log dose</button></form></td></tr>; })}</tbody></table></section>}</main>;
}
