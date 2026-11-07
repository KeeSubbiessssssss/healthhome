"use client";

import { useState, type FormEvent } from "react";
import { householdDateKey, weekdayNames, type BoardState, type Profile, type SchoolTrip } from "@/lib/board";
import { saveSchoolDay, schoolBy, schoolChildren, schoolChoice, schoolName, schoolTrip, schoolTripFromChoice } from "@/lib/school-travel";
import { DropPickSettings } from "./drop-pick-settings";
import type { BoardCommit } from "./schedule";
import s from "./family-board.module.css";

export function SchoolTransportSelect({ trip, people, name, label }: {trip: SchoolTrip;people: Profile[];name: string;label: string}) {
  return <label className={s.field}>{label}<select name={name} defaultValue={schoolChoice(trip)}><option value="">Not set</option><option value="bus">Bus</option>{people.map(person => <option key={person.id} value={`person:${person.id}`}>{person.name}</option>)}</select></label>;
}
export function SchoolTravelSettings({state,busy,commit}:{state:BoardState;busy:boolean;commit:BoardCommit}) {
  const initial = (new Date(householdDateKey() + "T12:00:00Z").getUTCDay() + 6) % 7;
  const [weekday,setWeekday] = useState(initial < 5 ? initial : 0);
  const children = schoolChildren(state);
  const people = state.profiles.filter(person => person.kind === "person");
  return <section className={s.schoolPlanner}>
    <h2>School travel</h2><p>Every weekday, every child. Set how they get to school and who’s picking them up.</p>
    <details className={s.schoolChildren}><summary>Children in this planner</summary><form onSubmit={event=>{event.preventDefault();const ids=new FormData(event.currentTarget).getAll("child").map(String);void commit(draft=>{draft.schoolTravel={profileIds:ids,days:draft.schoolTravel?.days || []};},"School planner children saved.");}}><fieldset className={s.activityChoices} disabled={busy}><legend>Choose the children</legend>{people.map(person=><label key={person.id}><input type="checkbox" name="child" value={person.id} defaultChecked={children.some(child=>child.id===person.id)}/>{schoolName(person)}</label>)}<button className={s.secondary}>Save children</button></fieldset></form></details>
    {!children.length ? <p>Select the children above to set up their school week.</p> : <>
      <nav className={s.schoolDayTabs} aria-label="School weekdays">{weekdayNames.slice(0,5).map((day,index)=><button key={day} aria-pressed={weekday===index} onClick={()=>setWeekday(index)}>{day.slice(0,3)}</button>)}</nav>
      <SchoolDayForm key={`${weekday}:${children.map(child=>child.id).join(",")}`} state={state} weekday={weekday} busy={busy} commit={commit}/>
    </>}
    {!!state.dropPick?.length && <details className={s.earlierSchoolEntries}><summary>Earlier Drop/Pick entries</summary><p>Clear drop-off and pickup entries appear in the planner automatically. Other notes stay here for review. Saving a day’s school plan takes priority.</p><DropPickSettings state={state} busy={busy} commit={commit}/></details>}
  </section>;
}
function SchoolDayForm({state,weekday,busy,commit}:{state:BoardState;weekday:number;busy:boolean;commit:BoardCommit}) {
  const children=schoolChildren(state);const people=state.profiles.filter(person=>person.kind==="person");
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); const data=new FormData(event.currentTarget);const action=(event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const trips=children.map(child=>({profileId:child.id,toSchool:schoolTripFromChoice(String(data.get(`${child.id}-to-school`)||""),String(data.get(`${child.id}-to-school-detail`)||"")),pickup:schoolTripFromChoice(String(data.get(`${child.id}-pickup`)||""),String(data.get(`${child.id}-pickup-detail`)||""))}));
    await commit(draft=>saveSchoolDay(draft,children.map(child=>child.id),weekday,trips,action==="week"),action==="week"?"School travel saved for Monday–Friday.":`${weekdayNames[weekday]} school travel saved.`);
  }
  return <form onSubmit={save}><h3>{weekdayNames[weekday]}</h3><fieldset disabled={busy} className={s.schoolDayFields}>{children.map(child=>{
    const morning=schoolTrip(state,child.id,weekday,"to-school");const pickup=schoolTrip(state,child.id,weekday,"pickup");
    return <section key={child.id} className={s.schoolChildRow}><h4><span className={`${s.profileDot} ${s[child.color]}`}/>{schoolName(child)}</h4><SchoolTransportSelect name={`${child.id}-to-school`} trip={morning.trip} people={people} label={`To school — ${schoolName(child)}`}/><SchoolTransportSelect name={`${child.id}-pickup`} trip={pickup.trip} people={people} label={`Pickup — ${schoolName(child)}`}/>{(morning.conflict||pickup.conflict)&&<p className={s.schoolConflict}>More than one earlier entry matches. Choose the arrangement to use.</p>}<details className={s.schoolDetails}><summary>Details (optional)</summary><label className={s.field}>To school detail<input name={`${child.id}-to-school-detail`} defaultValue={morning.trip.detail||""} maxLength={200}/></label><label className={s.field}>Pickup detail<input name={`${child.id}-pickup-detail`} defaultValue={pickup.trip.detail||""} maxLength={200}/></label></details></section>;
  })}<div className={s.formActions}><button className={s.primary} type="submit" value="day">{busy?"Saving…":`Save ${weekdayNames[weekday]}`}</button><button className={s.secondary} type="submit" value="week">Apply this plan to Mon–Fri</button></div></fieldset></form>;
}
export function SchoolDayNotes({state,weekday,profileId=""}:{state:BoardState;weekday:number;profileId?:string}){
  const children=schoolChildren(state).filter(child=>!profileId||child.id===profileId||["to-school","pickup"].some(journey=>schoolTrip(state,child.id,weekday,journey as "to-school"|"pickup").trip.byProfileId===profileId));
  return <div className={s.dropPickDay}><h4>School travel</h4>{children.map(child=><div key={child.id} className={s.schoolDayChild}><strong><span className={`${s.profileDot} ${s[child.color]}`}/>{schoolName(child)}</strong><span>To school: {schoolBy(schoolTrip(state,child.id,weekday,"to-school").trip,state.profiles)}</span><span>Pickup: {schoolBy(schoolTrip(state,child.id,weekday,"pickup").trip,state.profiles)}</span></div>)}{!children.length&&<span className={s.dropPickBlank}>No children selected</span>}</div>;
}
