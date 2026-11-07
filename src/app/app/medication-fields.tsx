"use client";

import { useState } from "react";
import { dailyDoseLabel, medicationRegimens, newId, type Medication, type Profile } from "@/lib/board";
import s from "./family-board.module.css";

export function MedicationScheduleFields({ medication, profiles }: { medication?: Medication; profiles: Profile[] }) {
  const [strength, setStrength] = useState(medication?.strength || "");
  const [supplyUnit, setSupplyUnit] = useState(medication?.unit || "tablets");
  const [rows, setRows] = useState(() => (medication ? medicationRegimens(medication) : [{ profileId: "", unitsPerDose: 1, dosesPerDay: 1, doseTiming: "", instructions: "" }]).map((r, index) => ({ ...r, key: `initial-${index}`, units: String(r.unitsPerDose), frequency: String(r.dosesPerDay) })));
  const update = (key: string, values: Partial<typeof rows[number]>) => setRows(current => current.map(row => row.key === key ? { ...row, ...values } : row));
  return <>
    <label className={s.field}>Strength per unit<input name="strength" value={strength} onChange={event => setStrength(event.target.value)} placeholder="e.g. 75 mg or 10 mg / 5 mL" maxLength={500}/><small>Include the strength unit from the label.</small></label>
    <label className={s.field}>Supply unit<input name="unit" value={supplyUnit} onChange={event => setSupplyUnit(event.target.value)} placeholder="tablets, capsules, mL…" maxLength={500} required/></label>
    <div className={s.regimenEditor}>
      <p>One shared inventory, with separate dose instructions for each person or pet.</p>
      {rows.map(row => <fieldset className={s.regimenFields} key={row.key}><legend>{profiles.find(p => p.id === row.profileId)?.name || "Family member or pet"}</legend>
        <label className={s.field}>For<select name="regimenProfileId" value={row.profileId} onChange={event => update(row.key, { profileId: event.target.value })} required><option value="">Choose a family member or pet</option>{profiles.map(profile => <option key={profile.id} value={profile.id} disabled={rows.some(r => r.key !== row.key && r.profileId === profile.id)}>{profile.name}{profile.kind === "pet" ? " · Pet" : ""}</option>)}</select></label>
        <label className={s.field}>Units per dose<input type="number" name="regimenUnits" value={row.units} onChange={event => update(row.key, { units: event.target.value })} min="0.0001" step="0.0001" required/></label>
        <label className={s.field}>Doses per day (0 for as needed)<input type="number" name="regimenFrequency" value={row.frequency} onChange={event => update(row.key, { frequency: event.target.value })} min="0" step="1" required/></label>
        <label className={s.field}>Total Daily Dose<input value={dailyDoseLabel({ strength, unit: supplyUnit, unitsPerDose: Number(row.units), dosesPerDay: Number(row.frequency) })} readOnly/></label>
        <label className={s.field}>Dose timing<input name="regimenTiming" defaultValue={row.doseTiming} placeholder="e.g. morning and evening, with food" maxLength={500}/></label>
        <label className={s.field}>Instructions / notes<textarea name="regimenInstructions" defaultValue={row.instructions} placeholder="Directions for this family member or pet" maxLength={4000}/></label>
        {rows.length > 1 && <button type="button" className={s.textButton} onClick={() => setRows(current => current.filter(r => r.key !== row.key))}>Remove {profiles.find(p => p.id === row.profileId)?.name || "this assignment"}</button>}
      </fieldset>)}
      <button type="button" className={s.secondary} disabled={rows.length >= profiles.length} onClick={() => setRows(current => [...current, { key: newId(), profileId: "", units: "1", frequency: "1", unitsPerDose: 1, dosesPerDay: 1, doseTiming: "", instructions: "" }])}>Add family member or pet</button>
    </div>
  </>;
}

export function DoseRecipientFields({ medication, profiles }: { medication: Medication; profiles: Profile[] }) {
  const regimens = medicationRegimens(medication);
  const [profileId, setProfileId] = useState(regimens.length === 1 ? regimens[0].profileId : "");
  const [units, setUnits] = useState(regimens.length === 1 ? String(regimens[0].unitsPerDose) : "");
  return <>
    <label className={s.field}>Who received this dose?<select name="doseProfileId" value={profileId} required={regimens.length > 1 || !!regimens[0].profileId} onChange={event => { setProfileId(event.target.value); setUnits(String(regimens.find(r => r.profileId === event.target.value)?.unitsPerDose || "")); }}><option value="">Choose a family member or pet</option>{regimens.map(r => <option key={r.profileId} value={r.profileId}>{profiles.find(p => p.id === r.profileId)?.name || "Unassigned"}</option>)}</select></label>
    <label className={s.field}>Amount given ({medication.unit})<input name="units" type="number" value={units} onChange={event => setUnits(event.target.value)} min="0.0001" step="0.0001" required/></label>
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
