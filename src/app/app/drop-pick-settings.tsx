"use client";

import { useState, type FormEvent } from "react";
import { newId, weekdayNames, dropPickProfileIds, dropPickByLabel, type BoardState, type DropPick, type Profile } from "@/lib/board";
import type { BoardCommit } from "./schedule";
import s from "./family-board.module.css";

export function DropPickSettings({ state, busy, commit }: { state: BoardState; busy: boolean; commit: BoardCommit }) {
  const [editing, setEditing] = useState<string | null>(null);
  const entry = state.dropPick?.find(entry => entry.id === editing);
  const people = state.profiles.filter(person => person.kind === "person");
  const names = (entry: DropPick) => dropPickProfileIds(entry).map(id => people.find(person => person.id === id)?.name || "Unknown").join(" & ");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const profileIds = data.getAll("profileId").map(String);
    const by = String(data.get("by") || "");
    const value: DropPick = { id: entry?.id || newId(), profileId: profileIds[0] || "", profileIds, note: String(data.get("note") || "").trim(), byProfileId: by.startsWith("person:") ? by.slice(7) : "", ...(by === "bus" ? { transport: "bus" } : {}), weekdays: data.getAll("weekday").map(Number) };
    const ok = await commit(draft => {
      if (!profileIds.length) throw new Error("Choose at least one family member for Drop/Pick.");
      if (!value.weekdays.length) throw new Error("Choose at least one weekday for Drop/Pick.");
      const entries = draft.dropPick || [];
      const index = entries.findIndex(entry => entry.id === value.id);
      if (index < 0) entries.push(value); else entries[index] = value;
      draft.dropPick = entries;
    }, "Drop/Pick saved.");
    if (ok) setEditing(null);
  }
  return <section className={s.settingsGroup}>
    <div className={s.sectionHeading}><h2>Drop/Pick</h2><button className={s.secondary} disabled={busy || !people.length} onClick={() => setEditing("new")}>Add Drop/Pick</button></div>
    <p className={s.dropPickHelp}>Choose who’s travelling together, a little reminder, and a person or bus. Shown above each weekday on your schedule.</p>
    {editing !== null && <form key={editing} className={s.editor} onSubmit={save}><h3>{entry ? "Edit Drop/Pick" : "Add Drop/Pick"}</h3><fieldset className={s.formFields} disabled={busy}>
      <DropPickFields entry={entry} people={people}/>
      <div className={s.formActions}><button type="submit" className={s.primary}>{busy ? "Saving…" : "Save Drop/Pick"}</button><button type="button" className={s.textButton} onClick={() => setEditing(null)}>Cancel</button></div>
    </fieldset></form>}
    <ul className={s.dropPickSettingsList}>{(state.dropPick || []).map(entry => <li key={entry.id}><div><strong>{names(entry)}</strong><span>{entry.note}</span><small>By {dropPickByLabel(entry, state.profiles)} · {entry.weekdays.map(day => weekdayNames[day].slice(0, 3)).join(", ")}</small></div><div className={s.activityActions}><button className={s.textButton} disabled={busy} onClick={() => setEditing(entry.id)} aria-label={`Edit Drop/Pick for ${names(entry)}: ${entry.note}`}>Edit</button><button className={s.textButton} disabled={busy} onClick={() => { if (window.confirm(`Remove “${entry.note}” for ${names(entry)} from Drop/Pick?`)) void commit(draft => { draft.dropPick = draft.dropPick?.filter(item => item.id !== entry.id); draft.dropPickOverrides = draft.dropPickOverrides?.filter(item => item.entryId !== entry.id); }, "Drop/Pick removed.").then(ok => { if (ok && editing === entry.id) setEditing(null); }); }}>Remove</button></div></li>)}</ul>
    {!state.dropPick?.length && editing === null && <p className={s.dropPickHelp}>{people.length ? "No Drop/Pick entries yet." : "Add family members in Settings to start."}</p>}
  </section>;
}

export function DropPickFields({ entry, people, showWeekdays = true }: { entry?: DropPick; people: Profile[]; showWeekdays?: boolean }) {
  return <>
      <fieldset className={s.activityChoices}><legend>Family members (choose one or more)</legend>{people.map(person => <label key={person.id}><input type="checkbox" name="profileId" value={person.id} defaultChecked={entry ? dropPickProfileIds(entry).includes(person.id) : false}/><span className={`${s.profileDot} ${s[person.color]}`}/>{person.name}</label>)}</fieldset>
      <label className={s.field}>Note<input name="note" defaultValue={entry?.note} required maxLength={200} placeholder="School drop, pickup…"/></label>
      <label className={s.field}>By<select name="by" defaultValue={entry?.transport === "bus" ? "bus" : entry?.byProfileId ? `person:${entry.byProfileId}` : ""}><option value="">Not assigned</option><option value="bus">Bus</option>{people.map(person => <option key={person.id} value={`person:${person.id}`}>{person.name}</option>)}</select></label>
      {showWeekdays && <fieldset className={s.activityChoices}><legend>Every week on</legend>{weekdayNames.slice(0, 5).map((day, index) => <label key={day}><input type="checkbox" name="weekday" value={index} defaultChecked={entry ? entry.weekdays.includes(index) : true}/>{day.slice(0, 3)}</label>)}</fieldset>}
  </>;
}
