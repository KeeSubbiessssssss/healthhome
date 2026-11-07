import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyBoard, parseBoard, weekDates, householdDateKey, weeklyAgenda, summaryPreferences, setSummaryPreferences, constrainPlacement, validScheduleSize } from '../src/lib/board.ts';
const activity = () => ({ id: 'activity', title: 'Swimming', profileIds: ['person'], weekdays: [0, 2], startTime: '16:00', endTime: '17:00', color: 'blue' });
const board = () => ({ ...emptyBoard(), profiles: [{ id: 'person', name: 'Alex', kind: 'person', birthday: '', species: '', color: 'rose' }], activities: [activity()] });
test('weekly activities survive saves and legacy boards need no data conversion', () => {
 assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(board()))).activities, [activity()]);
 assert.doesNotThrow(() => parseBoard(emptyBoard()));
});
test('weekly recurrence uses Sydney dates across midnight, year boundaries and daylight saving', () => {
 assert.equal(householdDateKey(new Date('2026-11-07T13:30:00Z')), '2026-11-08');
 assert.deepEqual(weekDates(new Date('2026-11-07T13:30:00Z')), ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
 assert.equal(weekDates(new Date('2027-01-01T00:00:00Z'))[0], '2026-12-28');
 assert.deepEqual(weekDates(new Date('2026-10-04T05:00:00Z')).slice(-2), ['2026-10-03', '2026-10-04']);
});
test('agenda only creates actual occurrences, sorts their times and respects assigned people', () => {
 const first = activity(); const second = { ...activity(), id: 'earlier', startTime: '08:00', endTime: '', profileIds: [] };
 const now = new Date('2026-11-07T00:00:00Z'); const agenda = weeklyAgenda([first, second], now);
 assert.equal(agenda.length, 2); assert.equal(agenda[0].weekday, 0); assert.equal(agenda[0].activities[0].id, 'earlier');
 assert.equal(weeklyAgenda([first, second], now, 0, 'other')[0].activities.length, 1);
 assert.equal(weeklyAgenda([first], now, 1)[0].date, '2026-11-09');
});
test('invalid recurrence days, times, references and duplicate identifiers are rejected', () => {
 for (const mutation of [a => a.weekdays = [], a => a.weekdays = [7], a => a.weekdays = [0,0], a => a.weekdays = [.5], a => a.startTime = '25:00', a => a.endTime = '15:59', a => a.endTime = a.startTime, a => a.profileIds = ['unknown'], a => a.profileIds = ['person','person']]) {
  const state = board(); mutation(state.activities[0]); assert.throws(() => parseBoard(state));
 }
 const state = board(); state.activities.push(activity()); assert.throws(() => parseBoard(state));
});
test('summaries can be pinned, filtered, customised and hidden while retaining note placement', () => {
 const state = board(); const prefs = { pinned: true, fields: ['week','people'], profileId: 'person' };
 setSummaryPreferences(state, 'schedule', prefs); setSummaryPreferences(state, 'schedule', prefs);
 assert.equal(state.order.filter(id => id === 'schedule').length, 1);
 assert.deepEqual(summaryPreferences(parseBoard(JSON.parse(JSON.stringify(state))), 'schedule'), prefs);
 const original = structuredClone(state.noteLayout.schedule);
 setSummaryPreferences(state, 'schedule', { ...prefs, pinned: false }); assert.deepEqual(state.noteLayout.schedule, original); assert.doesNotThrow(() => parseBoard(state));
 assert.equal(summaryPreferences(emptyBoard(), 'medications').pinned, true); assert.equal(summaryPreferences(emptyBoard(), 'tasks-summary').pinned, false);
 setSummaryPreferences(state, 'tasks-summary', { pinned: true, fields: ['totals','due'], profileId: '' }); assert.doesNotThrow(() => parseBoard(state));
});
test('invalid summary options and orphaned personal filters are rejected', () => {
 for (const prefs of [{ pinned:true, fields:[], profileId:'' }, { pinned:true, fields:['location'], profileId:'' }, { pinned:true, fields:['totals','totals'], profileId:'' }, { pinned:true, fields:['totals'], profileId:'unknown' }]) {
  const state=board(); state.summaries={medications:prefs}; assert.throws(() => parseBoard(state));
 }
});
test('schedule resizing stays landscape and within the board, and survives serialization', () => {
 const state=board(); setSummaryPreferences(state,'schedule',{pinned:true,fields:['week'],profileId:''});
 const placement=constrainPlacement({...state.noteLayout.schedule,x:900,width:800,height:2000});
 assert.equal(placement.x,400); assert.equal(placement.width,800); assert.equal(placement.height,500);
 assert.equal(validScheduleSize(placement.width,placement.height),true);
 state.noteLayout.schedule=placement; assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(state))).noteLayout.schedule,placement);
 const smaller=constrainPlacement({...placement,width:100,height:900});assert.equal(smaller.width,360);assert.equal(smaller.height,300);
 assert.equal(validScheduleSize(300,260),false); assert.equal(validScheduleSize(600,Infinity),false);
 const wrong=board();wrong.noteLayout={welcome:{...placement,x:0}};assert.throws(()=>parseBoard(wrong));
});
test('Drop/Pick entries round trip with weekday and personal profile validation', () => {
 const state = board();
 state.profiles.push({ ...state.profiles[0], id: 'driver', name: 'Sam' });
 const entry = { id: 'drop', profileId: 'person', note: 'School pickup', byProfileId: 'driver', weekdays: [0,2,4] };
 state.dropPick = [entry];
 assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(state))).dropPick, [entry]);
 for (const mutation of [e => e.weekdays = [], e => e.weekdays = [5], e => e.weekdays = [1,1], e => e.profileId = 'unknown', e => e.byProfileId = 'unknown', e => e.note = '', e => e.note = 'x'.repeat(201)]) {
  const invalid = structuredClone(state); mutation(invalid.dropPick[0]); assert.throws(() => parseBoard(invalid));
 }
 const pet = structuredClone(state); pet.profiles[1].kind = 'pet'; assert.throws(() => parseBoard(pet));
 const duplicate = structuredClone(state); duplicate.dropPick.push(entry); assert.throws(() => parseBoard(duplicate));
});
test('shared Drop/Pick supports travelling together, bus and unassigned transport while preserving old entries', async () => {
 const { dropPickProfileIds, dropPickByLabel } = await import('../src/lib/board.ts');
 const state = board(); state.profiles.push({ ...state.profiles[0], id:'second', name:'Sam' });
 const shared = { id:'shared-drop', profileId:'person', profileIds:['person','second'], note:'School pickup', byProfileId:'', transport:'bus', weekdays:[0,1] };
 state.dropPick = [shared];
 assert.deepEqual(parseBoard(structuredClone(state)).dropPick, [shared]);
 assert.deepEqual(dropPickProfileIds(shared), ['person','second']);
 assert.equal(dropPickByLabel(shared,state.profiles),'Bus');
 const unassigned = { ...shared }; delete unassigned.transport;
 state.dropPick = [unassigned]; assert.doesNotThrow(()=>parseBoard(state)); assert.equal(dropPickByLabel(unassigned,state.profiles),'Not assigned');
 const old = {id:'old-drop',profileId:'person',note:'Pickup',byProfileId:'second',weekdays:[2]};
 state.dropPick = [old]; assert.doesNotThrow(()=>parseBoard(state)); assert.deepEqual(dropPickProfileIds(old),['person']); assert.equal(dropPickByLabel(old,state.profiles),'Sam');
 for (const change of [e=>e.profileIds=[],e=>e.profileIds=['second'],e=>e.profileIds=['person','person'],e=>e.profileIds=['person','missing'],e=>e.byProfileId='second',e=>e.transport='unknown']) {
  const invalid = {...board(),profiles:state.profiles,dropPick:[structuredClone(shared)]}; change(invalid.dropPick[0]); assert.throws(()=>parseBoard(invalid));
 }
 const pet = {...board(),profiles:state.profiles.map(p=>p.id==='second'?{...p,kind:'pet'}:p),dropPick:[shared]}; assert.throws(()=>parseBoard(pet));
});
test('schedule summary can hide school travel without hiding the schedule or daily note', () => {
 const state=board();setSummaryPreferences(state,'schedule',{pinned:true,fields:['week','people'],profileId:'',showSchoolTravel:false});
 assert.equal(parseBoard(structuredClone(state)).summaries.schedule.showSchoolTravel,false);
 assert.equal(summaryPreferences(state,'drop-pick').pinned,true);
 setSummaryPreferences(state,'schedule',{...state.summaries.schedule,showSchoolTravel:true});assert.doesNotThrow(()=>parseBoard(state));
 state.summaries.schedule.showSchoolTravel='false';assert.throws(()=>parseBoard(state));
});
