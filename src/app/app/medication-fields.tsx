"use client";

import { useState } from "react";
import { dailyDoseLabel, type Medication } from "@/lib/board";
import s from "./family-board.module.css";

export function MedicationScheduleFields({ medication }: { medication?: Medication }) {
  const [strength, setStrength] = useState(medication?.strength || "");
  const [supplyUnit, setSupplyUnit] = useState(medication?.unit || "tablets");
  const [units, setUnits] = useState(String(medication?.unitsPerDose ?? 1));
  const [frequency, setFrequency] = useState(String(medication?.dosesPerDay ?? 1));
  const total = dailyDoseLabel({ strength, unit: supplyUnit, unitsPerDose: Number(units), dosesPerDay: Number(frequency) });
  return <>
    <label className={s.field}>Strength per unit<input name="strength" value={strength} onChange={event => setStrength(event.target.value)} placeholder="e.g. 75 mg or 10 mg / 5 mL" maxLength={500}/><small>Include the strength unit from the label.</small></label>
    <label className={s.field}>Supply unit<input name="unit" value={supplyUnit} onChange={event => setSupplyUnit(event.target.value)} placeholder="tablets, capsules, mL…" maxLength={500} required/></label>
    <label className={s.field}>Units per dose<input type="number" name="unitsPerDose" value={units} onChange={event => setUnits(event.target.value)} min="0.0001" step="0.0001" required/></label>
    <label className={s.field}>Doses per day (0 for as needed)<input type="number" name="dosesPerDay" value={frequency} onChange={event => setFrequency(event.target.value)} min="0" step="1" required/></label>
    <label className={s.field}>Total Daily Dose<input value={total} readOnly/><small>Strength × units per dose × doses per day. Concentrations use the stated volume.</small></label>
    <label className={s.field}>Dose timing<input name="doseTiming" defaultValue={medication?.doseTiming || ""} placeholder="e.g. morning and evening, with food" maxLength={500}/></label>
  </>;
}

export function InventoryFields({ medication }: { medication: Medication }) {
  const [action, setAction] = useState("none");
  return <>
    <p className={s.formHelp}>Current inventory: <strong>{medication.unitsLeft} {medication.unit}</strong>. Inventory changes leave the dose instructions unchanged. Use “Consume” for stock used outside a dose log, so it isn’t counted twice.</p>
    <label className={s.field}>Inventory action<select name="stockAction" value={action} onChange={event => setAction(event.target.value)}><option value="none">Update inventory settings only</option><option value="replenish">Replenish — add stock</option><option value="consume">Consume — subtract stock</option><option value="correct">Correct — set actual balance</option><option value="repeat">Fill prescription repeat</option></select></label>
    {action !== "none" && action !== "repeat" && <label className={s.field}>{action === "correct" ? "Actual balance" : action === "consume" ? "Quantity consumed" : "Quantity to add"} ({medication.unit})<input key={action} type="number" name="stockAmount" defaultValue={action === "correct" ? medication.unitsLeft : ""} min={action === "correct" ? 0 : .0001} step="0.0001" required/></label>}
    {action !== "none" && <label className={s.field}>Reason / note<input name="stockNote" maxLength={500} placeholder="e.g. new pack, stock count, spillage"/></label>}
    <label className={s.field}>Low stock reminder at ({medication.unit})<input type="number" name="refillAt" defaultValue={medication.refillAt} min="0" step="0.0001" required/></label>
    <label className={s.field}>Units per refill ({medication.unit})<input type="number" name="unitsPerRefill" defaultValue={medication.unitsPerRefill} min="0" step="0.0001" required/></label>
    <label className={s.field}>Repeats remaining<input type="number" name="repeats" defaultValue={medication.repeats} min="0" step="1" required/></label>
    {action === "repeat" && <p className={s.formHelp}>Adds the units per refill entered above and uses one repeat from the entered repeats remaining.</p>}
  </>;
}
