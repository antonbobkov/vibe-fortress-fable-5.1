/**
 * T-457: what hostiles did at the doors and what they cost and suffered, for the three-year file. Read-only: it
 * listens to the world's events.
 */
import { C } from '@core/components';
import { liesDown } from '@core/movement';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { HEXER_RUNE } from '@systems/magic/constants';
import type { TestWorld } from './test-world';

export interface PartyFigures {
  /** Hostiles dead, by faction group: raiders (`hostile:<civ>`), `cavern`, `deep`. */
  hostilesDied: Record<string, number>;
  /** Dwarves dead, by the faction of what killed them. */
  dwarvesKilledBy: Record<string, number>;
  /** A hostile's steps onto a built door's tile. */
  doorSteps: number;
  /** Of those, with a fortress creature standing in the doorway. */
  doorStepsPastFortress: number;
  /** Of those, with a soldier standing in the doorway. */
  doorStepsPastSoldier: number;
  /** What the raids' hexers did (25 § Hexers). */
  hexers: HexerFigures;
}

export interface HexerFigures {
  /** Hexers that arrived. */
  arrived: number;
  /** Frost bolts cast. */
  casts: number;
  /** Hexers that cast their whole rune. */
  spent: number;
  /** Bolt hits with damage on a fortress creature. */
  frostHits: number;
  /** Bolt hits with damage on a creature not of the fortress: their own side, or a wild animal. */
  otherHits: number;
  /** Blows struck in melee. */
  blows: number;
  /** Hexers dead. */
  died: number;
  /** Dwarves dead whose killer was a hexer. */
  dwarvesKilled: number;
  /** For comparison: the archers of the same parties, and the arrows they loosed. */
  archers: number;
  arrows: number;
}

const groupOf = (faction: string): string => (faction === 'hostile:cavern' ? 'cavern' : faction === 'deep' ? 'deep' : faction.startsWith('hostile') ? 'raiders' : faction);

export class PartyWatch {
  readonly figures: PartyFigures = {
    hostilesDied: {}, dwarvesKilledBy: {}, doorSteps: 0, doorStepsPastFortress: 0, doorStepsPastSoldier: 0,
    hexers: { arrived: 0, casts: 0, spent: 0, frostHits: 0, otherHits: 0, blows: 0, died: 0, dwarvesKilled: 0, archers: 0, arrows: 0 },
  };

  constructor(w: TestWorld) {
    const ent = w.game.world.entities;
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    const hostile = (faction: string): boolean => faction.startsWith('hostile') || faction === 'deep';
    const f = this.figures;
    const h = f.hexers;
    // A hexer's id and its casts so far, kept past its death.
    const hexers = new Map<EntityId, number>();
    const archers = new Set<EntityId>();
    w.game.world.onEvents((events) => {
      const buildings = w.readers.of<BuildingsReader>('14');
      for (const e of events) {
        if (e.type === 'EntitiesMoved') {
          for (const [id, , to] of e['moves'] as [EntityId, TileIndex, TileIndex][]) {
            if (!buildings.doorAt(to) || !hostile(ent.get(id, C.Creature)?.faction ?? '')) continue;
            f.doorSteps += 1;
            const others = w.readers.entities.at(to).filter((o) => o !== id && ent.get(o, C.Creature)?.faction === 'fortress' && !liesDown(ent, o));
            if (others.length > 0) f.doorStepsPastFortress += 1;
            if (others.some((o) => ent.has(o, C.Soldier))) f.doorStepsPastSoldier += 1;
          }
        } else if (e.type === 'HostileSpawned') {
          const id = Number(e['id']);
          const role = ent.get(id, C.Hostile)?.role;
          if (role === 'hexer') { hexers.set(id, 0); h.arrived += 1; }
          if (role === 'archers') { archers.add(id); h.archers += 1; }
        } else if (e.type === 'ProjectileFired') {
          if (archers.has(Number(e['shooterId']))) h.arrows += 1;
        } else if (e.type === 'SpellCast') {
          const id = Number(e['casterId']);
          const casts = hexers.get(id);
          if (casts === undefined) continue;
          hexers.set(id, casts + 1);
          h.casts += 1;
          if (casts + 1 === HEXER_RUNE) h.spent += 1;
        } else if (e.type === 'DamageDealt' && hexers.has(Number(e['attackerId'])) && Number(e['amount']) > 0) {
          if (e['damageType'] !== 'frost') continue;
          if (ent.get(Number(e['defenderId']), C.Creature)?.faction === 'fortress') h.frostHits += 1;
          else h.otherHits += 1;
        } else if (e.type === 'AttackResolved' && hexers.has(Number(e['attackerId'])) && e['damageType'] !== 'frost') {
          h.blows += 1;
        } else if (e.type === 'CreatureDied') {
          if (hexers.has(Number(e['id']))) h.died += 1;
          if (e['species'] === dwarf && hexers.has(Number(e['killerId'] ?? 0))) h.dwarvesKilled += 1;
          const faction = String(e['faction'] ?? '');
          if (hostile(faction)) f.hostilesDied[groupOf(faction)] = (f.hostilesDied[groupOf(faction)] ?? 0) + 1;
          else if (faction === 'fortress' && e['species'] === dwarf) {
            const killer = ent.get(Number(e['killerId'] ?? 0), C.Creature)?.faction ?? 'none or gone';
            f.dwarvesKilledBy[groupOf(killer)] = (f.dwarvesKilledBy[groupOf(killer)] ?? 0) + 1;
          }
        }
      }
    });
  }
}
