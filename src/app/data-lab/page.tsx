import { desc, eq } from "drizzle-orm";

import { addDemoMedication } from "@/app/data-lab/actions";
import { db } from "@/lib/db";
import { inventoryEvents, medicationStock, medications } from "@/db/schema";

export const dynamic = "force-dynamic";

function formatQuantity(value: number) {
  return value.toFixed(2).replace(/\\.00$/, "");
}

export default async function DataLabPage() {
  if (process.env.VERCEL_ENV === "production") {
    return <main className="data-lab-shell"><p className="eyebrow">HealthHome</p><h1>Data lab is available in Preview.</h1><p>Production never accepts synthetic test data.</p></main>;
  }

  const stocks = await db.select({ stockId: medicationStock.id, medicationName: medications.name, unit: medicationStock.unit, openingQuantity: medicationStock.openingQuantity, reorderAtQuantity: medicationStock.reorderAtQuantity, targetQuantity: medicationStock.targetQuantity }).from(medicationStock).innerJoin(medications, eq(medicationStock.medicationId, medications.id)).orderBy(desc(medications.createdAt));
  const events = await db.select({ stockId: inventoryEvents.stockId, quantityDelta: inventoryEvents.quantityDelta }).from(inventoryEvents);
  const inventory = stocks.map((stock) => {
    const eventDelta = events.filter((event) => event.stockId === stock.stockId).reduce((total, event) => total + Number(event.quantityDelta), 0);
    const currentQuantity = Number(stock.openingQuantity) + eventDelta;
    return { ...stock, currentQuantity, needsRefill: currentQuantity <= Number(stock.reorderAtQuantity) };
  });

  return (
    <main className="data-lab-shell">
      <p className="eyebrow">HealthHome · Preview only</p>
      <h1>Medication inventory data lab</h1>
      <p className="data-lab-intro">A simple safety check for the underlying ledger. Each receipt, dose, expiry, or adjustment changes stock through an event rather than overwriting a remaining total.</p>
      <form action={addDemoMedication}><button type="submit">Add synthetic 56-tablet receipt</button></form>
      {inventory.length === 0 ? <section className="data-lab-empty"><h2>No test stock yet</h2><p>Add a synthetic receipt to prove the preview database write and running-total calculation.</p></section> : <section className="data-lab-table-wrap" aria-label="Medication inventory"><table><thead><tr><th scope="col">Medication</th><th scope="col">Current</th><th scope="col">Refill at</th><th scope="col">Target</th><th scope="col">Status</th></tr></thead><tbody>{inventory.map((stock) => <tr key={stock.stockId}><td>{stock.medicationName}</td><td>{formatQuantity(stock.currentQuantity) + " " + stock.unit}</td><td>{formatQuantity(Number(stock.reorderAtQuantity)) + " " + stock.unit}</td><td>{stock.targetQuantity ? formatQuantity(Number(stock.targetQuantity)) + " " + stock.unit : "—"}</td><td><span className={stock.needsRefill ? "status status-warning" : "status"}>{stock.needsRefill ? "Refill" : "In stock"}</span></td></tr>)}</tbody></table></section>}
    </main>
  );
}
