/**
 * T-543 probe (not kept in test/): every fight between a wild aggressive or territorial animal and a
 * creature of the fortress, the first blow of each pair each day, with who struck, the animal's state,
 * both tiles, the dwarf's job, squad and weapon, the alert, and the dwarf deaths by a wild animal.
 */
import { it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { AnimalsReader } from '@systems/animals';
import type { CombatReader } from '@systems/combat/reader';
import { TestWorld } from '../scenarios/test-world';
import { runThreeYearsSeed } from './three_years_seeds.test';

const SEED = process.env['T543_SEED'] ?? 'three-years-p4-4';
const START = Number(process.env['T543_START'] ?? 0) * TICKS_PER_DAY;
const STOP = Number(process.env['T543_STOP'] ?? 336) * TICKS_PER_DAY;
const PERIL = Number(/-p(\d)-/.exec(SEED)?.[1] ?? 4);

it(`T-543 probe ${SEED}`, () => {
  const log: string[] = [];
  const original = TestWorld.prototype.step;
  const seen = new WeakSet<TestWorld>();
  const install = (w: TestWorld): void => {
    const world = w.game.world;
    const ent = world.entities;
    const map = world.map;
    const animals = world.readers.of<AnimalsReader>('08');
    const combat = world.readers.of<CombatReader>('16');
    const board = (world.scheduler.byId('11') as unknown as { board: { typeId(job: unknown): string; jobs: Map<number, unknown> } }).board;
    const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const pos = (id: number): string => { const p = ent.get(id, C.Position); return p ? `${p.x},${p.y},${p.z}` : '-'; };
    const wildRow = (id: number): { id: string; temper?: string } | undefined => (ent.has(id, C.Wild) ? animals.def(ent.get(id, C.Creature)?.species ?? -1) as { id: string; temper?: string } | undefined : undefined);
    const fortress = (id: number): boolean => ent.get(id, C.Creature)?.faction === 'fortress';
    const job = (id: number): string => { const j = ent.get(id, C.Worker)?.jobId ?? 0; const job = j === 0 ? undefined : board.jobs.get(j); return job === undefined ? 'idle' : board.typeId(job); };
    const squad = (id: number): boolean => combat.squads().some((s) => s.members.includes(id));
    const label = (id: number): number => { const p = ent.get(id, C.Position); return p ? world.readers.pathing.labelOf(map.index(p.x, p.y, p.z), 'walker') : -1; };
    const noted = new Set<string>();
    let doorsLogged = false;
    world.onEvents((events: readonly GameEvent[]) => {
      if (w.tick < START) return;
      if (!doorsLogged && w.tick >= START + 10) {
        doorsLogged = true;
        const arrival = w.game.arrival as unknown as { wagonTile?: number } | undefined;
        log.push(`wagon ${arrival?.wagonTile === undefined ? '-' : `${map.xOf(arrival.wagonTile)},${map.yOf(arrival.wagonTile)},${map.zOf(arrival.wagonTile)}`}`);
      }
      for (const e of events) {
        if (e.type === 'AttackResolved') {
          const a = Number(e['attackerId']);
          const d = Number(e['defenderId']);
          const ra = wildRow(a);
          const rd = wildRow(d);
          const animal = ra && fortress(d) ? a : rd && fortress(a) ? d : 0;
          if (animal === 0) continue;
          const row = (ra ?? rd)!;
          if (row.temper !== 'aggressive' && row.temper !== 'territorial') continue;
          const dwarf = animal === a ? d : a;
          const key = `${animal}:${dwarf}:${day()}`;
          if (noted.has(key)) continue;
          noted.add(key);
          log.push(`day ${day()} t${w.tick} ${animal === a ? `${row.id} ${animal} strikes ${dwarf}` : `${dwarf} strikes ${row.id} ${animal}`} (${String(e['outcome'])}) ` +
            `animal ${ent.get(animal, C.Wild)?.state ?? '?'} hungry ${ent.get(animal, C.Wild)?.hungry ?? '?'} at ${pos(animal)} L${label(animal)} | dwarf at ${pos(dwarf)} L${label(dwarf)} job ${job(dwarf)} ` +
            `squad ${squad(dwarf)} weapon ${combat.weaponOf(dwarf) !== 0} | alert ${world.fortress.alert}`);
        }
        if (e.type === 'CreatureDied' && fortress(Number(e['id']))) {
          const k = Number(e['killerId'] ?? 0);
          const r = k === 0 ? undefined : animals.def(ent.get(k, C.Creature)?.species ?? -1) as { id: string } | undefined;
          log.push(`day ${day()} t${w.tick} DIED ${e['id']} ${String(e['cause'])} killer ${k} ${r?.id ?? ''} at ${pos(Number(e['id']))} alert ${world.fortress.alert}`);
        }
      }
    });
  };
  TestWorld.prototype.step = function (this: TestWorld, n?: number) {
    if (!seen.has(this)) {
      seen.add(this);
      install(this);
    }
    const r = original.call(this, n as number);
    if (this.tick > STOP) throw new Error('stop');
    return r;
  } as typeof original;
  try {
    const r = runThreeYearsSeed(SEED, PERIL);
    console.log(`[t543] ${SEED} shift ${process.env['THREE_YEARS_SHIFT'] ?? '0'} y3Pop ${r.y3Pop} deaths ${r.dwarfDeaths}`);
  } catch (e) {
    if ((e as Error).message !== 'stop') throw e;
  } finally {
    TestWorld.prototype.step = original;
    console.log(['[t543] log', ...log].join('\n'));
  }
}, 7_200_000);
