/**
 * T-457: what hostiles did at the doors and what they cost and suffered, for the three-year file. Read-only: it
 * listens to the world's events.
 */
import { C } from '@core/components';
import { liesDown } from '@core/movement';
import type { EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
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
}

const groupOf = (faction: string): string => (faction === 'hostile:cavern' ? 'cavern' : faction === 'deep' ? 'deep' : faction.startsWith('hostile') ? 'raiders' : faction);

export class PartyWatch {
  readonly figures: PartyFigures = { hostilesDied: {}, dwarvesKilledBy: {}, doorSteps: 0, doorStepsPastFortress: 0, doorStepsPastSoldier: 0 };

  constructor(w: TestWorld) {
    const ent = w.game.world.entities;
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    const hostile = (faction: string): boolean => faction.startsWith('hostile') || faction === 'deep';
    const f = this.figures;
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
        } else if (e.type === 'CreatureDied') {
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
