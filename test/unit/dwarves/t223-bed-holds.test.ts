/** T-223 one saved bed hold for walking sleepers, sleepers and patients. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

function setup(seed: string, secondBed = true) {
 const w = new TestWorld({seed,world:'flat-test',embark:'none',surfaceWildlife:'none'});
 const near=w.build('bed',w.index(12,10,Z),'oak');
 const far=secondBed?w.build('bed',w.index(14,10,Z),'oak'):0;
 const a=w.spawnDwarf({at:w.index(10,10,Z)});
 const b=w.spawnDwarf({at:w.index(10,11,Z)});
 for(const id of [a,b]) {
  for(const need of ['hunger','thirst','rest','social','comfort','purpose','joy'] as const) w.setNeed(id,need,0);
  w.setNeed(id,'rest',95);
 }
 const reader=()=>w.readers.of<BuildingsReader>('14');
 return {w,a,b,near,far,reader};
}

describe('T-223 a bed holds one dwarf from selection until release',()=>{
 it('two tired dwarves choose two beds in the same tick and sleep separately',()=>{
  const {w,a,b,near,far,reader}=setup('t223-two-beds');
  w.step(1);
  expect(w.dwarves.activities.plans.get(a)?.itemId).toBe(near);
  expect(w.dwarves.activities.plans.get(b)?.itemId).toBe(far);
  expect(reader().freeBeds()).toEqual([]);
  w.until(()=>[a,b].every(id=>w.dwarves.activities.plans.get(id)?.phase==='use'),100);
  expect(w.game.world.services.movement?.tileOf(a)).not.toBe(w.game.world.services.movement?.tileOf(b));
  w.until(()=>w.events('Slept').filter(e=>[a,b].includes(Number(e['id']))).length===2,500);
  expect(w.events('Slept')).toMatchObject([{id:a,onFloor:false},{id:b,onFloor:false}]);
  expect(reader().freeBeds()).toEqual([near,far]);
 });
 it('with one held bed the second dwarf uses the floor, and walking holds survive a save',()=>{
  const {w,a,b,near,reader}=setup('t223-saved-hold',false);
  w.step(1);
  expect(w.dwarves.activities.plans.get(a)?.itemId).toBe(near);
  expect(w.dwarves.activities.plans.get(b)?.itemId).toBe(0);
  const loaded=roundTrip(w.game).game;
  expect(loaded.hash()).toBe(w.hash());
  expect(loaded.world.readers.of<BuildingsReader>('14').freeBeds()).toEqual([]);
  for(let tick=0;tick<50;tick+=1){w.step(1);loaded.step(1);expect(loaded.hash()).toBe(w.hash());}
  expect(reader().freeBeds()).toEqual([]);
  w.until(()=>w.events('Slept').some(e=>e['id']===b),500);
  expect(w.events('Slept').find(e=>e['id']===b)).toMatchObject({onFloor:true});
 });
 it('a patient holds its bed against a tired medic',()=>{
  const {w,a,b,near,far,reader}=setup('t223-patient-first');
  w.setNeed(a,'rest',0);w.setLabor(a,'medicine',false);
  w.game.world.emit({type:'DamageDealt',defenderId:a,attackerId:0,part:'torso',damageType:'edge',amount:15});
  // Admit before the medic becomes tired; the patient component is the saved hold.
  w.setNeed(b,'rest',0); w.step(1);
  expect(w.game.world.entities.get(a,C.Patient)?.bedId).toBe(near);
  w.setNeed(b,'rest',95);w.step(1);
  expect(w.dwarves.activities.plans.get(b)?.itemId).toBe(far);
  expect(reader().freeBeds()).toEqual([]);
 });
 it('a newly admitted patient does not take a bed already held by a sleeper',()=>{
  const {w,a,b,near,far}=setup('t223-sleeper-first');
  w.setNeed(b,'rest',0);w.step(1);
  expect(w.dwarves.activities.plans.get(a)?.itemId).toBe(near);
  w.game.world.emit({type:'DamageDealt',defenderId:b,attackerId:0,part:'torso',damageType:'edge',amount:15});w.step(1);
  expect(w.game.world.entities.get(b,C.Patient)?.bedId).toBe(far);
 });
 it('a patient with no available bed waits instead of sharing an occupied hospital bed',()=>{
  const {w,a,b,near}=setup('t223-hospital-full',false);
  w.build('chest',w.index(13,10,Z),'oak');
  w.zone('hospital',[w.index(12,10,Z),w.index(13,10,Z)]);
  for(const id of [a,b]) {
   w.setNeed(id,'rest',0);w.setLabor(id,'medicine',false);
   w.game.world.emit({type:'DamageDealt',defenderId:id,attackerId:0,part:'torso',damageType:'edge',amount:15});
  }
  w.step(1);
  expect(w.game.world.entities.get(a,C.Patient)?.bedId).toBe(near);
  expect(w.game.world.entities.get(b,C.Patient)?.bedId).toBe(0);
  // Force the ordinary behavior selection after admission; duty interruption is T-211.
  w.dwarves.interruptFlags.add(b);w.step(1);
  const brain=w.game.world.entities.get(b,C.Brain)!;
  expect(brain.behavior).toBe('patient');
  expect(brain.targetTile).toBe(w.game.world.services.movement?.tileOf(b));
  expect(brain.targetTile).not.toBe(w.index(12,10,Z));
  const body=w.game.world.entities.get(a,C.Body)!;
  for(const part of body.parts) for(const wound of part.wounds) Object.assign(wound,{bandaged:true,bleed:0,sutured:true,cleaned:true});
  w.until(()=>w.game.world.entities.get(b,C.Patient)?.bedId===near,20);
  w.step(1);
  expect(w.game.world.entities.get(b,C.Brain)?.targetTile).toBe(w.index(12,10,Z));
 });
 it('keeps bedroom ownership while excluding a patient hold even for the owner',()=>{
  const {w,a,b,near,far,reader}=setup('t223-owned-bed');
  const zone=w.zone('bedroom',[w.index(12,10,Z)]);
  expect(w.game.world.applyCommand({type:'AssignRoom',zoneId:zone,dwarfId:a}).ok).toBe(true);
  // A saved clinical hold can occupy the owner's bed; ownership never overrides occupancy.
  w.game.world.entities.add(b,C.Patient,{hospitalZoneId:0,bedId:near,needs:['diagnose'],admittedTick:0});
  w.setNeed(b,'rest',0);w.step(1);
  expect(w.dwarves.activities.plans.get(a)?.itemId).toBe(far);
  expect(reader().bedHolder(near)).toBe(b);
  expect(reader().ownerOf(zone)).toBe(a);
 });
 it('a failed sleep walk releases its saved hold',()=>{
  const {w,a,b,near,far,reader}=setup('t223-failed-walk');w.step(1);
  const movement=w.game.world.services.movement!;
  const original=movement.walkTo;movement.walkTo=()=> 'unreachable';
  try {w.step(1);} finally {movement.walkTo=original;}
  expect(w.dwarves.activities.plans.has(a)).toBe(false);
  expect(w.dwarves.activities.plans.has(b)).toBe(false);
  expect(reader().freeBeds()).toEqual([near,far]);
 });
 it('death releases a walking hold and a critical meal cancels one without taking another bed',()=>{
  const {w,a,b,near,far,reader}=setup('t223-release'); w.step(1);
  w.spawnItem('easy_meal','dimcap',w.index(10,11,Z));
  w.setNeed(b,'hunger',100);w.step(1);
  expect(w.dwarves.activities.plans.get(b)?.need).toBe('hunger');
  expect(reader().freeBeds()).toEqual([far]);
  w.game.world.emit({type:'DamageDealt',defenderId:a,attackerId:0,part:'torso',damageType:'edge',amount:2*w.game.world.entities.get(a,C.Body)!.parts[1]!.maxHp});
  w.until(()=>!w.game.world.entities.alive(a),5);
  expect(w.game.world.entities.alive(a)).toBe(false);
  expect(reader().freeBeds()).toEqual([near,far]);
 });
});
