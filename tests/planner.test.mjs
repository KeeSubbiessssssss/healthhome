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
