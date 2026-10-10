import { C } from '@core/components';
import type { CommandType } from '@core/command-types';
import type { Command } from '@core/commands';
import type { EventType } from '@core/event-types';
import type { GameEvent, Unsubscribe } from '@core/events';
import { World } from '@core/world';

/** T-157: observations of accepted commands and delivered events in stepped worlds. */
export interface ScenarioCoverage {
  readonly commands: ReadonlySet<CommandType>;
  readonly events: ReadonlySet<EventType>;
  readonly jobs: ReadonlySet<string>;
  readonly buildings: ReadonlySet<string>;
}

/**
 * Record all worlds used by a scenario, including its compact trial worlds and saved-game
 * replacements. Restore the prototype methods and listeners in finally when the run ends.
 * No event is counted on emission: a world must actually deliver it during step.
 */
export function recordWorlds(): { readonly coverage: ScenarioCoverage; dispose(): void } {
  const commands = new Set<CommandType>();
  const events = new Set<EventType>();
  const jobs = new Set<string>();
  const buildings = new Set<string>();
  const attached = new WeakSet<World>();
  const detach: Unsubscribe[] = [];
  const originalApply = World.prototype.applyCommand;
  const originalStep = World.prototype.step;

  const buildingType = (world: World, id: unknown): void => {
    if (typeof id !== 'number') return;
    const building = world.entities.get(id, C.Building);
    if (building?.state !== 'built') return;
    const row = world.registry.table<{ id: string }>('buildings').byIndex(building.type);
    if (row) buildings.add(row.id);
  };
  const observe = (world: World, batch: readonly GameEvent[]): void => {
    for (const event of batch) {
      events.add(event.type);
      if (event.type === 'JobCreated' || event.type === 'JobCompleted') {
        if (typeof event['jobType'] === 'string') jobs.add(event['jobType']);
      }
      if (event.type === 'BuildingCompleted') {
        if (typeof event['buildingType'] === 'string') buildings.add(event['buildingType']);
        else buildingType(world, event['id']);
      }
      if (event.type === 'Embarked') for (const id of world.entities.with(C.Building)) buildingType(world, id);
    }
  };
  const attach = (world: World): void => {
    if (attached.has(world)) return;
    attached.add(world);
    for (const id of world.entities.with(C.Building)) buildingType(world, id);
    detach.push(world.onEvents((batch) => observe(world, batch)));
  };

  World.prototype.applyCommand = function(this: World, command: Command) {
    attach(this);
    const result = originalApply.call(this, command);
    if (result.ok) commands.add(command.type);
    return result;
  };
  World.prototype.step = function(this: World) {
    attach(this);
    originalStep.call(this);
  };
  return {
    coverage: { commands, events, jobs, buildings },
    dispose() {
      World.prototype.applyCommand = originalApply;
      World.prototype.step = originalStep;
      for (const unsubscribe of detach) unsubscribe();
      detach.length = 0;
    },
  };
}
