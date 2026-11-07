import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyBoard,parseBoard } from '../src/lib/board.ts';
import { schoolChildren,schoolName,schoolTrip,schoolJourney,saveSchoolDay,setSchoolDayOverride,restoreSchoolDay } from '../src/lib/school-travel.ts';
const profile=(id,name,kind='person')=>({id,name,kind,birthday:'',species:'',color:'blue'});
const board=()=>({...emptyBoard(),profiles:[profile('dad','Dad'),profile('esme','Esme'),profile('ace','Ace'),profile('rhythm','Rhythm'),profile('pet','Cat','pet')]});
const bus={byProfileId:'',transport:'bus',detail:''}; const dad={byProfileId:'dad',detail:''};
const source=()=>({id:'old-trip',profileId:'ace',profileIds:['ace','rhythm'],weekdays:[0,1],note:'School pickup',byProfileId:'dad'});
test('planner defaults to the three children and uses Ezzie without renaming Esme elsewhere',()=>{
 const state=board();assert.deepEqual(schoolChildren(state).map(schoolName),['Ace','Rhythm','Ezzie']);assert.equal(state.profiles.find(p=>p.id==='esme').name,'Esme');
 assert.equal(schoolTrip(state,'ace',0,'to-school').trip.byProfileId,'');
});
test('saving a complete day or copying across weekdays keeps earlier records intact',()=>{
 const state=board();state.dropPick=[source()];const old=structuredClone(state.dropPick);
 const trips=['ace','rhythm','esme'].map(profileId=>({profileId,toSchool:bus,pickup:dad}));
 saveSchoolDay(state,trips.map(t=>t.profileId),0,trips,true);assert.equal(state.schoolTravel.days.length,15);assert.deepEqual(state.dropPick,old);assert.doesNotThrow(()=>parseBoard(state));
 assert.equal(schoolTrip(state,'esme',4,'to-school').trip.transport,'bus');
 saveSchoolDay(state,trips.map(t=>t.profileId),2,[{profileId:'ace',toSchool:dad,pickup:bus}]);
 assert.equal(schoolTrip(state,'ace',2,'pickup').trip.transport,'bus');assert.equal(schoolTrip(state,'rhythm',2,'pickup').trip.byProfileId,'dad');assert.equal(schoolTrip(state,'ace',3,'pickup').trip.byProfileId,'dad');
});
test('only unambiguous earlier directions prefill; explicit Not set beats earlier entries',()=>{
 const state=board();state.dropPick=[source()];assert.equal(schoolTrip(state,'ace',0,'pickup').trip.byProfileId,'dad');assert.equal(schoolTrip(state,'ace',0,'to-school').trip.byProfileId,'');
 assert.equal(schoolJourney({...source(),note:'School transport'}),undefined);
 state.dropPick.push({...source(),id:'second'});assert.equal(schoolTrip(state,'ace',0,'pickup').conflict,true);
 saveSchoolDay(state,['ace'],0,[{profileId:'ace',toSchool:{byProfileId:''},pickup:{byProfileId:''}}]);assert.equal(schoolTrip(state,'ace',0,'pickup').conflict,false);assert.equal(schoolTrip(state,'ace',0,'pickup').trip.byProfileId,'');
});
test('one child and one journey can change today while siblings, morning and next week stay unchanged',()=>{
 const state=board();state.dropPick=[source()];setSchoolDayOverride(state,'ace','pickup','2026-11-09',bus);
 assert.equal(schoolTrip(state,'ace',0,'pickup','2026-11-09').trip.transport,'bus');assert.equal(schoolTrip(state,'rhythm',0,'pickup','2026-11-09').trip.byProfileId,'dad');assert.equal(schoolTrip(state,'ace',0,'to-school','2026-11-09').trip.transport,undefined);assert.equal(schoolTrip(state,'ace',0,'pickup','2026-11-16').trip.byProfileId,'dad');
 setSchoolDayOverride(state,'ace','pickup','2026-11-09',null);assert.equal(schoolTrip(state,'ace',0,'pickup','2026-11-09').skipped,true);restoreSchoolDay(state,'ace','pickup','2026-11-09');assert.equal(schoolTrip(state,'ace',0,'pickup','2026-11-09').changed,false);assert.doesNotThrow(()=>parseBoard(state));
});
test('restoring a child from an older shared exception keeps the sibling exception',()=>{
 const state=board();state.dropPick=[source()];state.dropPickOverrides=[{id:'old-change',entryId:'old-trip',date:'2026-11-09',replacement:{...source(),byProfileId:'',transport:'bus'}}];
 restoreSchoolDay(state,'ace','pickup','2026-11-09');assert.equal(schoolTrip(state,'ace',0,'pickup','2026-11-09').trip.byProfileId,'dad');assert.equal(schoolTrip(state,'ace',0,'pickup','2026-11-09').changed,false);assert.equal(schoolTrip(state,'rhythm',0,'pickup','2026-11-09').trip.transport,'bus');assert.doesNotThrow(()=>parseBoard(state));
});
test('school plans and exceptions reject bad people, duplicate cells, invalid dates and weekends in weekly plans',()=>{
 const state=board();saveSchoolDay(state,['ace'],0,[{profileId:'ace',toSchool:bus,pickup:dad}]);setSchoolDayOverride(state,'ace','pickup','2026-11-09',bus);
 for(const mutate of [s=>s.schoolTravel.profileIds=['pet'],s=>s.schoolTravel.days[0].weekday=5,s=>s.schoolTravel.days[0].pickup.byProfileId='missing',s=>s.schoolTravel.days.push(s.schoolTravel.days[0]),s=>s.schoolTravelOverrides[0].date='2026-02-30',s=>s.schoolTravelOverrides[0].trip.byProfileId='dad',s=>s.schoolTravelOverrides[0].journey='other']){const invalid=structuredClone(state);mutate(invalid);assert.throws(()=>parseBoard(invalid));}
 assert.doesNotThrow(()=>parseBoard(structuredClone(state)));
});
