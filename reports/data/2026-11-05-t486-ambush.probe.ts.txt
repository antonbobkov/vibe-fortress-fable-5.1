/* eslint-disable @typescript-eslint/no-this-alias -- the probe hooks the world it is given */
/**
 * T-486 probe (not committed as a test): a seed of the three-year file through its own
 * `runThreeYearsSeed`, journalling every hostile party and every dwarf death.
 *
 * T486_SEED (`seed:peril`), T486_SHIFT (draws a hexer takes from 18's stream before its kit, as the
 * first version of T-479's kit did with its four rolls; 0: the filed code), T486_OUT (a JSONL file).
 * Run with `-t "T-486 probe"`, so the imported file's own tests are skipped.
 *
 * Lines: `party` at arrival, `sample` every SAMPLE ticks while an ambush, raid or siege is on the map
 * (state, morale, members standing, where they are, the dwarves in their perception, the alert),
 * `death` for each dwarf (killer, killer's party and state, victim's place and duty), `end`, `alert`.
 */
import { it, vi } from 'vitest';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import { TestWorld } from '../scenarios/test-world';
import { runThreeYearsSeed } from './three_years_seeds.test';

vi.mock('@systems/threats/gear', async (importOriginal) => {
  const real = await importOriginal<typeof import('@systems/threats/gear')>();
  const shift = Number(process.env['T486_SHIFT'] ?? 0);
  if (shift <= 0) return real;
  return {
    ...real,
    equipHostileCreature: (...args: Parameters<typeof real.equipHostileCreature>) => {
      const [, , rng, , , role] = args;
      if (role === 'hexer') for (let i = 0; i < shift; i += 1) rng.int(1, 1000);
      return real.equipHostileCreature(...args);
    },
  };
});

const SAMPLE = 250;
const out = process.env['T486_OUT'] ?? '.vite/t486.jsonl';
const [seedName, perilText] = (process.env['T486_SEED'] ?? 'three-years-p4-6:4').split(':');

function journal(): () => void {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, '');
  const line = (o: Record<string, unknown>): void => appendFileSync(out, JSON.stringify(o) + '\n');
  const original = TestWorld.prototype.step;
  let hooked: TestWorld | null = null;
  TestWorld.prototype.step = function (this: TestWorld, n?: number) {
    if (hooked !== this) {
      hooked = this;
      const w = this;
      const ent = w.game.world.entities;
      const map = w.game.world.map;
      const species = w.game.registry.table<{ id: string }>('creatures');
      const dwarf = species.index('dwarf');
      const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
      const sp = (id: number): string => species.byIndex(ent.get(id, C.Creature)?.species ?? -1)?.id ?? 'gone';
      const place = (id: number): Record<string, unknown> | null => {
        const p = ent.get(id, C.Position);
        if (!p) return null;
        const t = map.index(p.x, p.y, p.z);
        return { x: p.x, y: p.y, z: p.z, out: map.hasFlag(t, TileFlag.Outdoor) };
      };
      let lastSample = -SAMPLE;
      // The victim is gone when its death is delivered: its duty and behaviour as last sampled.
      const seen = new Map<number, { soldier: boolean; behavior: string }>();
      const tilePlace = (t: unknown): Record<string, unknown> | null => typeof t !== 'number' || t < 0 ? null
        : { x: map.xOf(t), y: map.yOf(t), z: map.zOf(t), out: map.hasFlag(t, TileFlag.Outdoor) };
      // When each dwarf was first on the map: an immigrant killed on arrival shows a small `onMap`.
      const firstSeen = new Map<number, number>();
      w.game.world.onEvents((events) => {
        for (const d of ent.with(C.Labors)) if (!firstSeen.has(d)) firstSeen.set(d, w.tick);
        for (const e of events) {
          if (e.type === 'ImmigrantsArrived') line({ k: e.type, tick: w.tick, day: day(), count: e['count'], ids: e['ids'] });
          if (e.type === 'RaidArrived' || e.type === 'AmbushSprung' || e.type === 'RaidEnded' || e.type === 'HostileFled' || e.type === 'AlertChanged' || e.type === 'ThreatWarning') {
            const pid = Number(e['partyId'] ?? 0);
            const P = pid === 0 ? undefined : ent.get(pid, C.Party);
            line({ k: e.type, tick: w.tick, day: day(), ...e, purpose: P?.purpose, morale: P?.morale, state: P?.state });
          }
          if (e.type === 'CreatureDied' && e['species'] === dwarf) {
            const k = Number(e['killerId'] ?? 0);
            const h = ent.get(k, C.Hostile);
            const party = h === undefined ? undefined : ent.get(h.partyId, C.Party);
            const v = Number(e['id'] ?? e['entityId'] ?? 0);
            line({ k: 'death', tick: w.tick, day: day(), cause: e['cause'], killer: k === 0 ? '-' : sp(k), role: h?.role, party: h?.partyId ?? 0,
              purpose: party?.purpose, pstate: party?.state, morale: party?.morale, victim: v, onMap: w.tick - (firstSeen.get(v) ?? 0), soldier: seen.get(v)?.soldier,
              behavior: seen.get(v)?.behavior, at: tilePlace(e['tile']), killerAt: place(k), alert: w.game.world.fortress.alert });
          }
        }
        if (w.tick - lastSample < SAMPLE) return;
        lastSample = w.tick;
        const dwarves = ent.with(C.Labors).filter((id) => ent.alive(id) && ent.get(id, C.Creature)?.faction === 'fortress');
        for (const d of dwarves) seen.set(d, { soldier: ent.get(d, C.Soldier)?.onDuty === true, behavior: ent.get(d, C.Brain)?.behavior ?? '-' });
        for (const pid of ent.with(C.Party)) {
          const P = ent.get(pid, C.Party);
          if (!P || P.state === 'gone' || (P.purpose !== 'ambush' && P.purpose !== 'raid' && P.purpose !== 'siege')) continue;
          const standing = P.members.filter((m) => ent.alive(m) && ent.has(m, C.Position) && ent.get(m, C.Body)?.conscious !== false && (ent.get(m, C.Creature)?.cagedIn ?? 0) === 0);
          const ps = standing.map((m) => ent.get(m, C.Position)!);
          let near = 0;
          let nearSoldiers = 0;
          let nearOut = 0;
          for (const d of dwarves) {
            const q = ent.get(d, C.Position);
            if (!q || !ps.some((p) => Math.abs(p.z - q.z) <= 2 && Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) <= 14)) continue;
            near += 1;
            if (ent.get(d, C.Soldier)?.onDuty === true) nearSoldiers += 1;
            if (map.hasFlag(map.index(q.x, q.y, q.z), TileFlag.Outdoor)) nearOut += 1;
          }
          const xs = ps.map((p) => p.x);
          const ys = ps.map((p) => p.y);
          const zs = ps.map((p) => p.z);
          line({ k: 'sample', tick: w.tick, day: day(), party: pid, purpose: P.purpose, state: P.state, morale: P.morale, members: P.members.length,
            standing: standing.length, nerveLost: P.members.filter((m) => ent.get(m, C.Hostile)?.nerveLost === true).length,
            stealthed: standing.filter((m) => ent.get(m, C.Hostile)?.stealthed === true).length,
            box: ps.length === 0 ? null : [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), Math.min(...zs), Math.max(...zs)],
            goal: P.goalTile, goalEntity: P.goalEntity, near, nearSoldiers, nearOut, dwarves: dwarves.length,
            dwarvesOut: dwarves.filter((d) => { const q = ent.get(d, C.Position); return q !== undefined && map.hasFlag(map.index(q.x, q.y, q.z), TileFlag.Outdoor); }).length,
            alert: w.game.world.fortress.alert });
        }
      });
    }
    return original.call(this, n as number);
  } as typeof original;
  return () => { TestWorld.prototype.step = original; };
}

it(`T-486 probe ${seedName}`, () => {
  const stop = journal();
  const r = runThreeYearsSeed(seedName!, Number(perilText));
  stop();
  appendFileSync(out, JSON.stringify({ k: 'result', shift: Number(process.env['T486_SHIFT'] ?? 0), seed: seedName, y1Pop: r.y1Pop, y2Pop: r.y2Pop, y3Pop: r.y3Pop, deaths: r.dwarfDeaths, extinct: r.extinctDay, raids: r.raidsList }) + '\n');
}, 3_600_000);
