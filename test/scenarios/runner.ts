/**
 * The scenario runner of `01-testing-strategy.md` § The scenario runner, which is the superset of
 * the headless scenario spec of `01-architecture/simulation-core.md` § Headless mode.
 *
 * Every scenario file under `test/scenarios` exports one `Scenario` as its default export and is
 * discovered by `index.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedSpec, regionSpec } from '@app/headless';
import type { RegionRecord } from '@systems/worldgen';
import { TestWorld } from './test-world';
import type { Command } from '@core/commands';
import type { GameSystem } from '@core/system';

const progressPath = fileURLToPath(new URL('../../docs/05-plan/PROGRESS.md', import.meta.url));

/** The `current-milestone: n` header line of `PROGRESS.md`, which gates which scenarios run. */
export function currentMilestone(): number {
  const text = readFileSync(progressPath, 'utf8');
  const match = /^current-milestone:\s*(\d+)\s*$/m.exec(text);
  if (match === null) throw new Error('PROGRESS.md has no "current-milestone: n" header line');
  return Number(match[1]);
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
  /** Direct world edits before tick 0, through `TestWorld` helpers only. */
  readonly setup?: (w: TestWorld) => void;
  readonly commands?: readonly ScheduledCommand[];
  /** A number of ticks, or a driver that steps and asserts itself. */
  readonly run: number | ((w: TestWorld) => void);
  readonly expect?: (w: TestWorld) => void;
  /**
   * The scenario cannot pass yet: a later milestone's system (`'M6'`) or a recorded spec
   * contradiction (`'C-002'`). The index reports it as `it.todo` with this tag (`00-agent-workflow.md`
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
