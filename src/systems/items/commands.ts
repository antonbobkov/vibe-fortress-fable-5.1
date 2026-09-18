/**
 * 13's item flag commands: `04-implementation/command-catalog.md` rows `ForbidItem` / `ClaimItem` /
 * `DumpItem` / `MeltItem` (`itemId | tiles[] | typeId, on`; "items exist; melt only metal items";
 * "`ItemReleased` when forbidding a reserved item cancels its job"), and
 * `02-systems/13-items-and-storage.md` § Forbid, dump, melt, claim ("Commands set flags on items,
 * on all items in a rectangle, or on all items of a type in the stocks panel").
 *
 * Items in a rectangle are the items lying on its tiles and everything inside them (D-068): a
 * forbidden bin keeps its contents out of every search too.
 */

import { C, ItemFlag } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { EntityReader } from '@core/readers';
import type { JobsApi } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { ItemCore } from './api';

export interface ItemCommandHost {
  readonly core: ItemCore;
  readonly entities: EntityReader;
  readonly jobs: JobsApi;
}

/** The items a command addresses, ascending; `null` when the addressing is malformed. */
export function addressed(host: ItemCommandHost, cmd: Command): EntityId[] | null {
  const core = host.core;
  const itemId = cmd['itemId'];
  const tiles = cmd['tiles'];
  const typeId = cmd['typeId'];
  const out = new Set<EntityId>();
  const addWithContents = (id: EntityId): void => {
    out.add(id);
    for (const inner of core.container(id)?.contents ?? []) addWithContents(inner);
  };
  if (typeof itemId === 'number') {
    if (!core.isItem(itemId)) return [];
    out.add(itemId);
  } else if (Array.isArray(tiles)) {
    const map = core.host.map;
    for (const t of tiles as unknown[]) {
      if (typeof t !== 'number' || !map.validIndex(t)) return null;
      for (const id of host.entities.at(t as TileIndex)) if (core.isItem(id)) addWithContents(id);
    }
  } else if (typeof typeId === 'string' || typeof typeId === 'number') {
    const t = typeof typeId === 'number' ? typeId : core.host.facts.typeIndex(typeId);
    if (!core.host.facts.has(t)) return [];
    for (const id of core.host.entities.with(C.Item)) if (core.item(id).type === t) out.add(id);
  } else {
    return null;
  }
  return Array.from(out).sort((a, b) => a - b);
}

function flagCommand(host: ItemCommandHost, cmd: Command, flag: ItemFlag, on: boolean): CommandResult {
  const ids = addressed(host, cmd);
  if (ids === null) return reject('precondition_failed');
  if (ids.length === 0) return reject('not_found');
  const core = host.core;
  if (flag === ItemFlag.Melt && on) {
    for (const id of ids) if (core.host.facts.materialClass(core.item(id).material) !== 'metal') return reject('not_metal');
  }
  for (const id of ids) {
    if (flag === ItemFlag.Forbidden && on) {
      const jobId = core.item(id).reservedBy;
      // "`ItemReleased` when forbidding a reserved item cancels its job": 11 releases on cancel.
      if (jobId !== 0) host.jobs.cancel(jobId, 'forbidden');
    }
    core.setFlag(id, flag, on);
  }
  return OK;
}

function onOf(cmd: Command): boolean {
  return cmd['on'] !== false;
}

export function applyForbidItem(host: ItemCommandHost, cmd: Command): CommandResult {
  return flagCommand(host, cmd, ItemFlag.Forbidden, onOf(cmd));
}

/** "`ClaimItem` (the same with `on: false`)". */
export function applyClaimItem(host: ItemCommandHost, cmd: Command): CommandResult {
  return flagCommand(host, cmd, ItemFlag.Forbidden, false);
}

export function applyDumpItem(host: ItemCommandHost, cmd: Command): CommandResult {
  return flagCommand(host, cmd, ItemFlag.Dump, onOf(cmd));
}

export function applyMeltItem(host: ItemCommandHost, cmd: Command): CommandResult {
  return flagCommand(host, cmd, ItemFlag.Melt, onOf(cmd));
}
