"use client";

import { dailyDoseLabel, giftIsBought, householdDateKey, medicationRegimens, medicationSupplyStatus, occasionsForGift, setSummaryPreferences, summaryMedicationList, summaryOptions, summaryPreferences, type BoardState, type SummaryKind } from "@/lib/board";
import { AgendaTiles, type BoardCommit } from "./schedule";
import s from "./family-board.module.css";

const kinds = Object.keys(summaryOptions) as SummaryKind[];
const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
export function SummaryOptionsEditor({ state, commit, busy, onClose }: { state: BoardState; commit: BoardCommit; busy: boolean; onClose: () => void }) {
  return <><header><h2>Make the board yours</h2><button className={s.textButton} onClick={onClose}>Close</button></header><form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void commit(draft => {
    for (const kind of kinds) {
      const pinned = data.has(`${kind}-pinned`); const fields = data.getAll(`${kind}-field`).map(String);
      if (pinned && !fields.length) throw new Error(`Choose at least one detail for the ${summaryOptions[kind].title} summary.`);
      setSummaryPreferences(draft, kind, { pinned, fields: fields.length ? fields : summaryPreferences(draft, kind).fields, profileId: String(data.get(`${kind}-profile`) || "") });
    }
  }, "Pinboard summaries saved.").then(ok => { if (ok) onClose(); }); }}><fieldset disabled={busy} className={s.summaryOptionsGrid}>{kinds.map(kind => { const prefs = summaryPreferences(state, kind); return <fieldset className={s.summaryOptionGroup} key={kind}><legend>{summaryOptions[kind].title}</legend><label className={s.summaryToggle}><input type="checkbox" name={`${kind}-pinned`} defaultChecked={prefs.pinned}/>Show on the pinboard</label><label className={s.field}>For<select name={`${kind}-profile`} defaultValue={prefs.profileId}><option value="">Everyone</option>{state.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>{summaryOptions[kind].fields.filter(field => kind !== "schedule" || field.id !== "totals").map(field => <label key={field.id}><input type="checkbox" name={`${kind}-field`} value={field.id} defaultChecked={prefs.fields.includes(field.id)}/>{field.label}</label>)}</fieldset>; })}<div className={s.formActions}><button className={s.primary} type="submit">{busy ? "Saving…" : "Save summaries"}</button><button type="button" className={s.textButton} onClick={onClose}>Cancel</button></div></fieldset></form></>;
}

export function SummaryNoteContent({ state, kind, onOpen, onEditActivity }: { state: BoardState; kind: SummaryKind; onOpen: () => void; onEditActivity?: (id: string) => void }) {
  const prefs = summaryPreferences(state, kind); const show = (id: string) => prefs.fields.includes(id);
  const person = (id: string) => state.profiles.find(p => p.id === id)?.name || "Unassigned";
  let contents;
  if (kind === "medications") {
    const meds = summaryMedicationList(state, prefs.profileId); const refills = meds.filter(m => medicationSupplyStatus(m).kind === "prescription"); const low = meds.filter(m => medicationSupplyStatus(m).kind === "low");
    contents = <>
      {show("totals") && <p className={s.summaryTotal}><strong>{meds.length}</strong> medications · {new Set(meds.flatMap(m => medicationRegimens(m).filter(r => !prefs.profileId || r.profileId === prefs.profileId).map(r => r.profileId)).filter(Boolean)).size} family members & pets</p>}
      {show("refills") && <div className={s.summarySection}><h3>New prescriptions</h3>{refills.length ? <ul>{refills.slice(0, 5).map(m => <li key={m.id}><strong>{m.name}</strong><span className={s.summaryUrgent}>0 repeats · {Math.floor(medicationSupplyStatus(m).daysLeft || 0)} days left</span></li>)}</ul> : <p>None needed within 12 days.</p>}</div>}
      {show("low") && <div className={s.summarySection}><h3>Low stock</h3>{low.length ? <ul>{low.slice(0, 5).map(m => <li key={m.id}>{m.name}<span>{m.unitsLeft} {m.unit} left</span></li>)}</ul> : <p>No low stock reminders.</p>}</div>}
      {show("doses") && <div className={s.summarySection}><h3>Daily doses</h3><ul>{meds.flatMap(m => medicationRegimens(m).filter(r => !prefs.profileId || r.profileId === prefs.profileId).map(r => ({ m, r }))).slice(0, 6).map(({ m, r }) => <li key={`${m.id}-${r.profileId}`}><strong>{person(r.profileId)} · {m.name}</strong><span>{dailyDoseLabel({ ...m, ...r })}</span></li>)}</ul>{!meds.length && <p>No medications added yet.</p>}</div>}
      {show("supply") && <div className={s.summarySection}><h3>Supply remaining</h3><ul>{meds.slice(0, 6).map(m => <li key={m.id}>{m.name}<span>{m.unitsLeft} {m.unit}{medicationSupplyStatus(m).daysLeft !== null && <> · {Math.floor(medicationSupplyStatus(m).daysLeft!)} days</>}</span></li>)}</ul></div>}
    </>;
  } else if (kind === "gifts") {
    const gifts = state.gifts.filter(g => !prefs.profileId || g.recipientId === prefs.profileId);
    contents = <>
      {show("totals") && <p className={s.summaryTotal}><strong>{gifts.length}</strong> ideas · {gifts.filter(g => g.status === "requested").length} requested · {gifts.filter(giftIsBought).length} bought · {gifts.filter(g => g.status === "wrapped").length} ready</p>}
      {show("spend") && <p className={s.summaryTotal}>Planned spend <strong>{money(gifts.reduce((sum, g) => sum + (g.cost || 0), 0))}</strong></p>}
      {show("occasions") && <p className={s.summaryTotal}>{gifts.filter(g => occasionsForGift(g).includes("birthday")).length} birthday ideas · {gifts.filter(g => occasionsForGift(g).includes("christmas")).length} Christmas ideas</p>}
      {show("ideas") && <ul className={s.summaryItems}>{gifts.slice(-5).reverse().map(g => <li key={g.id}><strong>{g.name}</strong><span>{person(g.recipientId)} · {g.status}</span></li>)}</ul>}
    </>;
  } else if (kind === "tasks-summary") {
    const tasks = state.lists.flatMap(list => list.items.map(task => ({ ...task, listTitle: list.title }))).filter(task => !prefs.profileId || task.assigneeId === prefs.profileId); const open = tasks.filter(task => !task.done); const today = householdDateKey();
    const due = open.filter(task => task.due && task.due <= today); const upcoming = open.filter(task => task.due > today).sort((a, b) => a.due.localeCompare(b.due));
    const rows = (items: typeof tasks) => <ul className={s.summaryItems}>{items.slice(0, 5).map(task => <li key={task.id}><strong>{task.text}</strong><span>{task.due} · {task.listTitle}</span></li>)}{items.length > 5 && <li>+{items.length - 5} more</li>}</ul>;
    contents = <>
      {show("totals") && <p className={s.summaryTotal}><strong>{open.length}</strong> open · {tasks.length - open.length} completed</p>}
      {show("due") && <div className={s.summarySection}><h3>Due today & overdue</h3>{due.length ? rows(due.sort((a, b) => a.due.localeCompare(b.due))) : <p>Nothing waiting on today.</p>}</div>}
      {show("upcoming") && <div className={s.summarySection}><h3>Coming up</h3>{upcoming.length ? rows(upcoming) : <p>No upcoming due dates.</p>}</div>}
    </>;
  } else {
    contents = <>
      {show("today") && <div className={s.summarySection}><h3>Today</h3><AgendaTiles state={state} profileId={prefs.profileId} compact todayOnly onEdit={onEditActivity} showPeople={show("people")}/></div>}
      {(show("week") || (!show("today") && show("people"))) && <AgendaTiles state={state} profileId={prefs.profileId} compact onEdit={onEditActivity} showPeople={show("people")}/>}
    </>;
  }
  return <><div className={s.noteTitle}><h2>{kind === "schedule" ? "Our week, on paper." : summaryOptions[kind].title}</h2></div>{prefs.profileId && <p className={s.noteMeta}>{person(prefs.profileId)}</p>}<div className={s.summaryContents}>{contents}</div><button className={s.noteLink} onClick={onOpen}>Open {summaryOptions[kind].title.toLowerCase()}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button></>;
}
