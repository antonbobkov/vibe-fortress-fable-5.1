/**
 * T-466 journal probe: defence_year on one seed, with a line for every event that touches a raid
 * or the bandits (arrival, each member's walk, traps, damage, deaths, loot, retreat, end) and the
 * squad's and the bridge's part. Read-only; asserts nothing. Seed from DEFENCE_SEED, output to
 * DEFENCE_OUT (one text line per record).
 */
import { it } from 'vitest';
import { appendFileSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import { playDefenceYear } from '../scenarios/defence_year_fortress';

const SEEDS = (process.env['DEFENCE_SEEDS'] ?? 'defence-year').split(',');
const OUT_DIR = process.env['DEFENCE_OUT'] ?? '.vite';
const KINDS = new Set((process.env['DEFENCE_KINDS'] ?? 'raid,bandits').split(','));

for (const SEED of SEEDS) it(`T-466 journal of defence_year on ${SEED}`, () => {
  const OUT = `${OUT_DIR}/t466-journal-${SEED}.txt`;
  writeFileSync(OUT, '');
  const log = (s: string): void => appendFileSync(OUT, s + '\n');
  const watched = new Map<number, { kind: string; members: number[] }>();
  const memberOf = new Map<number, number>();
  const roles = new Map<number, string>();
  const lootSeen = new Map<number, Set<number>>();
  let cx = 0; let cy = 0;
  let watchCalls = 0;
  const rel = (w: { map: { xOf(t: number): number; yOf(t: number): number; zOf(t: number): number } }, t: number): string =>
    t < 0 ? '-' : `${w.map.xOf(t) - cx},${w.map.yOf(t) - cy},${w.map.zOf(t)}`;
  const { w, state } = playDefenceYear({
    seed: SEED,
    observe: (tw, st) => {
      cx = st.fortress.cx; cy = st.fortress.cy;
      log(`fortress cx=${cx} cy=${cy}; coordinates below are relative (x-cx, y-cy, z). Corridor x=6, y=2..4; bridge y=0..1; north door y=5; stair y=6; south door y=7`);
      tw.game.world.onEvents((batch) => {
        const day = (): string => `d${Math.floor(tw.tick / TICKS_PER_DAY) + 1} t${tw.tick}`;
        const ent = tw.game.world.entities;
        const name = (id: number): string => {
          const party = memberOf.get(id);
          if (party !== undefined) return `R${party}:${id}(${roles.get(id) ?? ent.get(id, C.Hostile)?.role ?? '?'})`;
          if (ent.has(id, C.Soldier)) return `S:${id}`;
          return `${ent.get(id, C.Creature)?.faction ?? '?'}:${id}`;
        };
        const desc = (it: number): string => {
          const item = ent.get(it, C.Item);
          if (!item) return '(gone)';
          return `${tw.game.registry.table('items').byIndex(item.type)?.id}${(item.flags & 256) !== 0 ? ' foreign' : ''}`;
        };
        for (const e of batch) {
          if (e.type === 'RaidArrived') {
            const pid = e['partyId'] as number;
            const p = ent.get(pid, C.Party);
            if (!p || !KINDS.has(p.purpose)) continue;
            if (!watched.has(pid)) watched.set(pid, { kind: p.purpose, members: [] });
            log(`${day()} ARRIVED party ${pid} ${p.purpose} size ${String(e['size'])} edge ${p.edge}`);
          } else if (e.type === 'HostileSpawned') {
            const pid = e['partyId'] as number;
            const wp = watched.get(pid);
            const p = ent.get(pid, C.Party);
            if (p && KINDS.has(p.purpose)) {
              if (!watched.has(pid)) watched.set(pid, { kind: p.purpose, members: [] });
              watched.get(pid)!.members.push(e['id'] as number);
              memberOf.set(e['id'] as number, pid);
              roles.set(e['id'] as number, ent.get(e['id'] as number, C.Hostile)?.role ?? '?');
              void wp;
            }
          } else if (e.type === 'TrapTriggered') {
            const id = e['creatureId'] as number;
            if (memberOf.has(id)) log(`${day()} TRAP ${String(e['kind'])} on ${name(id)}: ${String(e['outcome'])}`);
          } else if (e.type === 'DamageDealt') {
            const d = e['defenderId'] as number; const a = e['attackerId'] as number;
            if (memberOf.has(d) || memberOf.has(a)) log(`${day()} HIT ${name(a)} -> ${name(d)} ${String(e['damageType'])} ${String(e['amount'])}`);
          } else if (e.type === 'CreatureDied') {
            const id = e['id'] as number;
            if (memberOf.has(id) || ent.has(id, C.Soldier)) log(`${day()} DIED ${name(id)} ${String(e['cause'])} by ${name(Number(e['killerId'] ?? 0))} at ${rel(tw, Number(e['tile'] ?? -1))}`);
          } else if (e.type === 'CreatureUnconscious') {
            const id = e['id'] as number;
            if (memberOf.has(id)) log(`${day()} DOWN ${name(id)}`);
          } else if (e.type === 'CreatureCaged') {
            const id = e['creatureId'] as number;
            if (memberOf.has(id)) log(`${day()} CAGED ${name(id)}`);
          } else if (e.type === 'HostileFled') {
            const id = e['id'] as number;
            if (memberOf.has(id)) log(`${day()} FLED ${name(id)}`);
          } else if (e.type === 'ThiefEscaped') {
            const id = e['id'] as number;
            if (memberOf.has(id)) {
              const it = e['itemId'] as number;
              log(`${day()} ESCAPED ${name(id)} with item ${it} ${desc(it)}`);
            }
          } else if (e.type === 'RaidEnded') {
            const pid = e['partyId'] as number;
            if (watched.has(pid)) log(`${day()} ENDED party ${pid} ${watched.get(pid)!.kind}: ${String(e['outcome'])}`);
          } else if (e.type === 'MechanismToggled' || e.type === 'BuildingStateChanged') {
            const id = e['id'] as number ?? e['buildingId'];
            if (watched.size > 0) log(`${day()} ${e.type} ${String(id)} ${String(e['state'] ?? e['on'] ?? '')}`);
          }
        }
      });
    },
    watch: (tw, st) => {
      watchCalls += 1;
      if (watchCalls % 5 !== 0) return;
      const ent = tw.game.world.entities;
      const items = tw.game.registry.table('items');
      for (const [pid, info] of watched) {
        const p = ent.get(pid, C.Party);
        if (!p) continue;
        if (p.state === 'gone') continue;
        const seen = lootSeen.get(pid) ?? new Set<number>();
        lootSeen.set(pid, seen);
        for (const l of p.loot) {
          if (seen.has(l)) continue;
          seen.add(l);
          const it = ent.get(l, C.Item);
          const carrier = it?.carriedBy ?? 0;
          const cp = ent.get(carrier, C.Position);
          log(`d${Math.floor(tw.tick / TICKS_PER_DAY) + 1} t${tw.tick} LOOT party ${pid} item ${l} ${it ? items.byIndex(it.type)?.id : 'animal'} foreign=${it ? (it.flags & 256) !== 0 : '?'} owner=${it?.ownerId ?? 0} by ${carrier} at ${cp ? `${cp.x - cx},${cp.y - cy},${cp.z}` : '-'}`);
        }
        const pos = info.members.map((m) => {
          if (!ent.alive(m)) return `${m}:dead`;
          const q = ent.get(m, C.Position);
          const b = ent.get(m, C.Body);
          const carried = p.loot.some((l) => ent.get(l, C.Item)?.carriedBy === m) ? '*' : '';
          return `${m}:${q ? `${q.x - cx},${q.y - cy},${q.z}` : 'off'}${b && !b.conscious ? '(ko)' : ''}${carried}`;
        });
        const buildings = tw.readers.of<BuildingsReader>('14');
        const bridge = st.drawbridgeId ? buildings.mechanismState(st.drawbridgeId) : '-';
        const north = st.fortress.gateDoorId2 ? buildings.mechanismState(st.fortress.gateDoorId2) : '-';
        const south = st.fortress.gateDoorId ? buildings.mechanismState(st.fortress.gateDoorId) : '-';
        const combat = tw.readers.of<CombatReader>('16');
        const squad = combat.squads().find((s) => s.id === st.fortress.squadId);
        const sq = (squad?.members ?? []).map((m) => {
          const q = ent.get(m, C.Position);
          return `${m}:${q ? `${q.x - cx},${q.y - cy},${q.z}` : '-'}>${combat.targetOf?.(m) ?? '?'}`;
        });
        log(`d${Math.floor(tw.tick / TICKS_PER_DAY) + 1} t${tw.tick} P${pid} ${p.state} goal ${rel(tw, p.goalTile)} unr=${p.goalUnreachable ?? false} loot=${p.loot.length} | ${pos.join(' ')} | bridge ${bridge} N ${north} S ${south} alert ${tw.game.world.fortress.alert} squad ${squad?.mode} ${sq.join(' ')}`);
      }
    },
  });
  const outcomes = w.events('RaidEnded').map((e) => `${String(e['partyId'])}:${String(e['outcome'])}`);
  log(`END day ${Math.floor(w.tick / TICKS_PER_DAY) + 1} outcomes ${outcomes.join(' ')} trial ${state.trial}`);
}, 3_600_000);
