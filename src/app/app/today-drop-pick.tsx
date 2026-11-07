"use client";

import { useEffect, useState, type FormEvent } from "react";
import { householdDateKey, summaryPreferences, type BoardState, type SchoolJourney } from "@/lib/board";
import { schoolBy, schoolChildren, schoolName, schoolTrip, schoolTripFromChoice, setSchoolDayOverride, restoreSchoolDay } from "@/lib/school-travel";
import { SchoolTransportSelect } from "./school-travel";
import type { BoardCommit } from "./schedule";
import s from "./family-board.module.css";

export function TodayDropPick(props: { state: BoardState; busy: boolean; commit: BoardCommit; onOpen: () => void }) {
  const [date, setDate] = useState(householdDateKey);
  useEffect(() => {
    const refresh = () => setDate(householdDateKey());
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return <DailyDropPick key={date} {...props} date={date}/>;
}
function DailyDropPick({ state, busy, commit, onOpen, date }: { state: BoardState; busy: boolean; commit: BoardCommit; onOpen: () => void; date: string }) {
  const [editing, setEditing] = useState<{profileId:string;journey:SchoolJourney}|null>(null);
  const weekday=(new Date(date+"T12:00:00Z").getUTCDay()+6)%7;
  const profileId=summaryPreferences(state,"drop-pick").profileId;
  const children=schoolChildren(state).filter(child=>!profileId||child.id===profileId||["to-school","pickup"].some(journey=>schoolTrip(state,child.id,weekday,journey as SchoolJourney,date).trip.byProfileId===profileId));
  const child=children.find(child=>child.id===editing?.profileId);
  const current=editing?schoolTrip(state,editing.profileId,weekday,editing.journey,date):null;
  const people=state.profiles.filter(person=>person.kind==="person");
  const label=(journey:SchoolJourney)=>journey==="to-school"?"To school":"Pickup";
  async function change(trip:ReturnType<typeof schoolTripFromChoice>|null){
    if(!editing)return;
    const ok=await commit(draft=>{if(householdDateKey()!==date)throw new Error("The day changed. Reopen today’s arrangement and try again.");setSchoolDayOverride(draft,editing.profileId,editing.journey,date,trip);},trip?"School travel changed for today only.":"School trip skipped for today only.");
    if(ok)setEditing(null);
  }
  function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);void change(schoolTripFromChoice(String(data.get("by")||""),String(data.get("detail")||"")));}
  return <div className={s.todayDropPick} data-note-scroll>
    <p className={s.todayDate}>{new Intl.DateTimeFormat("en-AU",{timeZone:"Australia/Sydney",weekday:"long",day:"numeric",month:"short"}).format(new Date(date+"T01:00:00Z"))}</p>
    {weekday>=5?<p>No school travel scheduled today.</p>:!children.length?<p>Choose the children in the weekly school travel planner.</p>:<ul>{children.map(child=><li key={child.id}>
      <div className={s.todayPeople}><span><i className={`${s.profileDot} ${s[child.color]}`}/><strong>{schoolName(child)}</strong></span></div>
      {(["to-school","pickup"] as const).map(journey=>{const result=schoolTrip(state,child.id,weekday,journey,date);return <div className={s.todaySchoolTrip} key={journey}><div><span>{label(journey)}</span><strong className={!result.trip.byProfileId&&!result.trip.transport&&!result.skipped?s.schoolUnset:undefined}>{result.skipped?"Skipped today":schoolBy(result.trip,state.profiles)}</strong>{result.changed&&!result.skipped&&<small>Changed today</small>}</div><button className={s.textButton} disabled={busy} onClick={()=>setEditing({profileId:child.id,journey})} aria-label={`Change ${schoolName(child)} ${label(journey).toLowerCase()} for today`}>Change</button></div>;})}
    </li>)}</ul>}
    {editing&&current&&child&&<form key={`${editing.profileId}:${editing.journey}`} className={s.todayEditor} onSubmit={save}><h3>{schoolName(child)} · {label(editing.journey)}</h3><p>Today only. The weekly plan stays the same.</p><fieldset className={s.formFields} disabled={busy}><SchoolTransportSelect trip={current.trip} people={people} name="by" label="How / with whom"/><label className={s.field}>Detail (optional)<input name="detail" maxLength={200} defaultValue={current.trip.detail||""}/></label><div className={s.formActions}><button type="submit" className={s.primary}>Save for today</button><button type="button" className={s.textButton} onClick={()=>void change(null)}>Skip today</button>{current.changed&&<button type="button" className={s.textButton} onClick={()=>void commit(draft=>restoreSchoolDay(draft,editing.profileId,editing.journey,date),"Weekly school arrangement restored.").then(ok=>{if(ok)setEditing(null);})}>Use weekly plan</button>}<button type="button" className={s.textButton} onClick={()=>setEditing(null)}>Cancel</button></div></fieldset></form>}
    <button className={s.noteLink} onClick={onOpen}>Open weekly schedule</button>
  </div>;
}
