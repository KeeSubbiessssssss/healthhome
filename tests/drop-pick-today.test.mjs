import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyBoard, parseBoard, dailyDropPick, setDropPickOverride, summaryPreferences, setSummaryPreferences } from '../src/lib/board.ts';
const source = () => ({id:'school',profileId:'alex',profileIds:['alex','sam'],byProfileId:'driver',note:'School pickup',weekdays:[0,1]});
const board = () => ({...emptyBoard(),profiles:['alex','sam','driver'].map(id=>({id,name:id,kind:'person',birthday:'',species:'',color:'blue'})),dropPick:[source()]});
test('one-date overrides change today without touching the weekly plan, tomorrow or next week', () => {
 const state=board(); const replacement={...source(),byProfileId:'',transport:'bus',note:'Bus home'};
 setDropPickOverride(state,'school','2026-11-09',replacement);
 assert.deepEqual(parseBoard(structuredClone(state)),state);
 assert.deepEqual(state.dropPick,[source()]);
 assert.equal(dailyDropPick(state,'2026-11-09')[0].entry.note,'Bus home');
 assert.equal(dailyDropPick(state,'2026-11-09')[0].changed,true);
 assert.equal(dailyDropPick(state,'2026-11-10')[0].entry.note,'School pickup');
 assert.equal(dailyDropPick(state,'2026-11-16')[0].entry.note,'School pickup');
 assert.equal(dailyDropPick(state,'2026-11-09','sam').length,1);
 assert.equal(dailyDropPick(state,'2026-11-09','driver').length,0);
});
test('skip and restore are reversible, date-specific, and repeated edits replace one override', () => {
 const state=board(); setDropPickOverride(state,'school','2026-11-09',null);
 assert.equal(dailyDropPick(state,'2026-11-09')[0].skipped,true);
 assert.equal(dailyDropPick(state,'2026-11-10')[0].skipped,false);
 setDropPickOverride(state,'school','2026-11-09',{...source(),note:'Later pickup'});
 assert.equal(state.dropPickOverrides.length,1); assert.equal(dailyDropPick(state,'2026-11-09')[0].skipped,false);
 state.dropPickOverrides=[]; assert.equal(dailyDropPick(state,'2026-11-09')[0].changed,false);
 assert.deepEqual(dailyDropPick(state,'2026-11-07'),[]);
});
test('invalid dates, orphan sources, duplicate dates and malformed replacement entries are rejected', () => {
 const state=board(); setDropPickOverride(state,'school','2026-11-09',source());
 for(const change of [o=>o.date='2026-02-30',o=>o.date='',o=>o.entryId='missing',o=>o.replacement.id='other',o=>o.replacement.profileIds=['unknown'],o=>o.replacement.byProfileId='unknown']) {
  const invalid=structuredClone(state); change(invalid.dropPickOverrides[0]); assert.throws(()=>parseBoard(invalid));
 }
 const duplicate=structuredClone(state);duplicate.dropPickOverrides.push({...duplicate.dropPickOverrides[0],id:'duplicate'});assert.throws(()=>parseBoard(duplicate));
});
test('daily note defaults on for legacy boards and can be hidden or repinned with saved placement', () => {
 const state=board();assert.equal(summaryPreferences(state,'drop-pick').pinned,true);assert.doesNotThrow(()=>parseBoard(state));
 setSummaryPreferences(state,'drop-pick',{pinned:true,fields:['arrangements'],profileId:''});
 state.noteLayout={'drop-pick':{x:20,y:40,angle:2,z:5,attachment:'pin'}};
 assert.doesNotThrow(()=>parseBoard(state));setSummaryPreferences(state,'drop-pick',{pinned:false,fields:['arrangements'],profileId:''});
 assert.doesNotThrow(()=>parseBoard(state)); assert.equal(state.noteLayout['drop-pick'].x,20);
});
