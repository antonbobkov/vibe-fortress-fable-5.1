/**
 * The scenario runner of `testing-strategy.md` § The scenario runner, which is the superset of
 * the headless scenario spec of `01-architecture/simulation-core.md` § Headless mode.
 *
 * Every scenario file under `test/scenarios` exports one `Scenario` as its default export and is
 * discovered by `index.test.ts`.
 */

import { generatedSpec, regionSpec } from '@app/headless';
import type { RegionRecord } from '@systems/worldgen';
import { TestWorld } from './test-world';
import type { Command } from '@core/commands';
import type { GameSystem } from '@core/system';

/** The last build milestone. A scenario's `milestone` records which one introduced it. */
export const LAST_MILESTONE = 8;

/**
 * The milestone the suites run up to. Every milestone is built, so every scenario runs
 * (`testing-strategy.md` § The scenario runner). During the build this came from a
 * `current-milestone` header and held back the scenarios of milestones not yet started.
 */
export function currentMilestone(): number {
  return LAST_MILESTONE;
}

export type Milestone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** `'flat-test'` per `acceptance-tests.md`; `'generated'` and a region spec since T-M1-05. */
export type ScenarioWorld = 'flat-test' | 'generated' | { readonly region: Record<string, unknown> };

/**
 * `'none'` is no dwarves; `'default'` is the Balanced preset of `embark-catalog.md`; an object names
 * another preset (`{ preset: 'warband' }`). T-M1-04.
 */
export type ScenarioEmbark = 'default' | 'none' | Record<string, unknown>;

export interface ScheduledCommand {
  readonly tick: number;
  readonly command: Command;
}

export interface Scenario {
  readonly id: string;
  readonly milestone: Milestone;
  readonly seed: string;
  readonly world: ScenarioWorld;
  readonly embark?: ScenarioEmbark;
  /**
   * Systems to register before `init`, built fresh for every run. The real systems join the
   * headless game as their milestones land; the `core_*` scenarios of M0 use this slot for the
   * stand-in systems that exercise the core machinery "with no real systems" (T-M0-08). See
   * DECISIONS.md D-036.
   */
  readonly systems?: () => readonly GameSystem[];
  /**
   * The calendar tick the world starts at, for scenarios whose rule depends on the season or the
   * hour (`pl_frost` needs winter; a render test needs daylight). T-M4-01.
   */
  readonly startTick?: number;
  /** Direct world edits before tick 0, through `TestWorld` helpers only. */
  readonly setup?: (w: TestWorld) => void;
  readonly commands?: readonly ScheduledCommand[];
  /** A number of ticks, or a driver that steps and asserts itself. */
  readonly run: number | ((w: TestWorld) => void);
  readonly expect?: (w: TestWorld) => void;
  /**
   * Vitest's per-test timeout, for a scenario that simulates far more than a few thousand ticks
   * (`year_one` runs a whole year; T-M7-11). Omitted takes `vitest.config.ts`'s `testTimeout`.
   */
  readonly timeoutMs?: number;
  /**
   * The scenario cannot pass yet: a later milestone's system (`'M6'`) or a recorded spec
   * contradiction (`'C-002'`). The index reports it as `it.todo` with this tag (`agent-workflow.md`
   * § Ambiguity protocol; `M3-water-fire-sky.md` T-M3-02 for `fl_drown`).
   */
  readonly todo?: string;
}

function buildWorld(scenario: Scenario): TestWorld {
  const embark = scenario.embark ?? 'none';
  if (typeof embark === 'object' && typeof embark['preset'] !== 'string') {
    throw new Error(`scenario ${scenario.id}: an embark spec names a preset ({ preset: id })`);
  }
  // T-M1-05: 'generated' is the standard world of the seed at its default region; a region spec is
  // the flat-test region with the given fields (DECISIONS.md D-046).
  const world =
    scenario.world === 'flat-test'
      ? ({ world: 'flat-test' } as const)
      : ({
          world: 'local',
          spec:
            scenario.world === 'generated'
              ? generatedSpec(scenario.seed)
              : regionSpec(scenario.seed, scenario.world.region as Partial<RegionRecord>),
        } as const);
  return new TestWorld({
    seed: scenario.seed,
    ...world,
    embark: typeof embark === 'object' ? { preset: embark['preset'] as string } : embark,
    ...(scenario.startTick === undefined ? {} : { startTick: scenario.startTick }),
    ...(scenario.systems === undefined ? {} : { systems: scenario.systems() }),
  });
}

/** Run one scenario to completion and return its world, so a caller may inspect it further. */
export function runScenario(scenario: Scenario): TestWorld {
  const w = buildWorld(scenario);
  scenario.setup?.(w);

  const scheduled = [...(scenario.commands ?? [])].sort((a, b) => a.tick - b.tick);
  let next = 0;
  const submitDue = (tick: number): void => {
    while (next < scheduled.length && (scheduled[next] as ScheduledCommand).tick <= tick) {
      w.submit((scheduled[next] as ScheduledCommand).command);
      next += 1;
    }
  };

  if (typeof scenario.run === 'number') {
    for (let t = 0; t < scenario.run; t += 1) {
      submitDue(w.tick);
      w.step(1);
    }
  } else {
    submitDue(w.tick);
    scenario.run(w);
  }

  scenario.expect?.(w);
  return w;
}
