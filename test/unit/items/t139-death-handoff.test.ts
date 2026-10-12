/** T-139: no carried item names a removed creature while waiting for corpse handoff. */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C, ItemFlag } from '@core/components';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

function victim(offset: number) {
 const w=new TestWorld({seed:`t139-handoff-${offset}`,world:'flat-test',embark:'none',surfaceWildlife:'none'});
 const at=w.index(12,10,Z);const id=w.spawnDwarf({at});
 const entities=w.game.world.entities;
 const clothes=Object.values(entities.get(id,C.Equipment)!.clothing).filter(item=>item!==0);
 for(const item of clothes)w.items.setOwner(item,id);
 w.step(offset);
 return {w,id,entities,clothes,at};
}
function die(a:ReturnType<typeof victim>) {
 const amount=2*a.entities.get(a.id,C.Body)!.parts[1]!.maxHp;
 a.w.game.world.emit({type:'DamageDealt',defenderId:a.id,attackerId:0,part:'torso',damageType:'blunt',amount});
 a.w.until(()=>a.w.events('CreatureDied').some(e=>e['id']===a.id),5);
}

describe('T-139 atomic clothing handoff on creature removal',()=>{
 it.each([0,1,2,3,4])('has a live corpse carrier when death is delivered at phase %i',offset=>{
  const a=victim(offset);let observed=false;
  a.w.game.world.onEvents(batch=>{
   if(!batch.some(e=>e.type==='CreatureDied'&&e['id']===a.id))return;
   observed=true;
   expect(a.entities.alive(a.id)).toBe(false);
   for(const item of a.clothes){
    const data=a.entities.get(item,C.Item)!;
    expect(a.entities.alive(data.carriedBy)).toBe(true);
    expect(a.entities.has(data.carriedBy,C.Corpse)).toBe(true);
    expect(data.ownerId).toBe(0);expect(data.flags&ItemFlag.Owned).toBe(0);
   }
  });
  die(a);expect(observed).toBe(true);
  expect(a.entities.with(C.Corpse)).toHaveLength(1);
  a.w.step(6);expect(a.w.events('CorpseCreated')).toHaveLength(1);
 });
 it('saves the immediate handoff and its pending events, preserving the next 50 hashes',()=>{
  const a=victim(2);die(a);
  const corpse=a.entities.with(C.Corpse)[0]!;expect(corpse).toBeDefined();
  expect(a.entities.get(corpse,C.Corpse)?.wornItems).toEqual(a.clothes);
  const loaded=roundTrip(a.w.game).game;expect(loaded.hash()).toBe(a.w.hash());
  for(let tick=0;tick<50;tick+=1){a.w.step(1);loaded.step(1);expect(loaded.hash()).toBe(a.w.hash());}
 });
 it('keeps worn clothing out of available counts and disposes it through corpse destruction',()=>{
  const a=victim(3);die(a);const corpse=a.entities.with(C.Corpse)[0]!;
  expect(corpse).toBeDefined();const items=a.w.readers.of<ItemsReader>('13');
  for(const item of a.clothes){
   const data=items.get(item)!;
   expect(items.stock(data.type).available).toBe(0);
   expect(data.carriedBy).toBe(corpse);
  }
  a.w.items.destroy(corpse,'buried');
  for(const item of a.clothes)expect(a.entities.alive(item)).toBe(false);
 });
});
