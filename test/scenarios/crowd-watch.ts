/**
 * T-457: how crowded the fortress's doors and hearth hall are, and for how long. Read-only: it samples
 * the crowd of each door tile and hall tile through the rule's own helper, so it moves nothing.
 */
import type { TileIndex } from '@core/types';
import { CROWD_FREE } from '@core/path-constants';
import type { BuildingsReader } from '@systems/buildings';
import type { TestWorld } from './test-world';

/** For one kind of place: the samples of its tiles, those over `CROWD_FREE`, and the worst and longest. */
export interface CrowdFigures {
  /** Tile-samples taken. */
  samples: number;
  /** Tile-samples with a crowd that slows (more than `CROWD_FREE`). */
  slowed: number;
  /** The largest crowd seen. */
  worst: number;
  /** The longest time one tile stayed crowded, in ticks. */
  longestTicks: number;
  /** Tile-samples slowed at the cap (twice the time). */
  capped: number;
}

const blank = (): CrowdFigures => ({ samples: 0, slowed: 0, worst: 0, longestTicks: 0, capped: 0 });

export class CrowdWatch {
  readonly doors = blank();
  readonly hall = blank();
  private readonly since = new Map<TileIndex, number>();

  constructor(private readonly w: TestWorld) {}

  /** One look at every door tile and every hearth-hall tile. */
  sample(): void {
    const buildings = this.w.readers.of<BuildingsReader>('14');
    const doors = buildings.byType('door').flatMap((id) => buildings.get(id)?.state === 'built' ? (buildings.get(id)?.footprint ?? []) : []);
    this.look(doors, this.doors);
    this.look(buildings.hearthHallTiles(), this.hall);
  }

  private look(tiles: readonly TileIndex[], into: CrowdFigures): void {
    const movement = this.w.game.movement;
    const tick = this.w.tick;
    for (const tile of tiles) {
      const percent = movement.crowdPercentAt(tile);
      into.samples += 1;
      if (percent === 100) {
        this.since.delete(tile);
        continue;
      }
      into.slowed += 1;
      if (percent === 200) into.capped += 1;
      into.worst = Math.max(into.worst, CROWD_FREE + (percent - 100) / 25);
      const from = this.since.get(tile) ?? tick;
      this.since.set(tile, from);
      into.longestTicks = Math.max(into.longestTicks, tick - from);
    }
  }
}
