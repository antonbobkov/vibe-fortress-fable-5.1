/**
 * The building panel (U-05; UI audit M4, § 5.4): `02-systems/14-buildings-and-rooms.md`
 * § Player-facing behavior ("Clicking a building opens its panel: state, mode toggles, links, owner,
 * deconstruct"), `19-defense-and-traps.md` § Player-facing behavior (trap mode, plate trigger, links)
 * and `ui-screens/panels.md` § Building.
 *
 * The panel is a list of lines. A line with an action can be reached three ways: the cursor and
 * `Enter`, a click, and (where it shows one) its accelerator. Choosing a link target and choosing an
 * owner replace the list until `Enter` or `Esc`. Every action is one existing command.
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import { PRIORITY_DEFAULT, PRIORITY_MAX, PRIORITY_MIN } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import type { KeyPress } from '@platform/input';
import type { Rect } from '@render/cellbuffer';
import type { BuildingView } from '@systems/buildings';
import type { DefenseReader } from '@systems/defense';
import type { JobsReader } from '@systems/jobs';
import { LINKABLE_TAGS, PLATE_LEVEL_MAX, PLATE_SIZE_MAX, PLATE_SIZE_STEP } from '../constants';
import { acceleratorLabel } from '../keymap';
import { buildingName, capitalize, jobBlockText, whereMade, wrapText, zoneName } from '../messages';
import type { Surface } from '../surface';
import { label, type ListState } from '../widgets';
import { accel, buildings, confirmThen, items, type PanelContext } from './context';
import { dwarvesOf, nameOf } from './units';

/** The door and hatch modes in the order the panel lists them (14 § Doors and hatches). */
const DOOR_MODE_ROWS: readonly string[] = ['open', 'locked', 'no_pets', 'lock_on_alert'];
const HATCH_MODE_ROWS: readonly string[] = ['open', 'locked'];
const TRAP_MODE_ROWS: readonly string[] = ['enemies', 'all'];

/** The plate triggers the panel lists (14 § Mechanisms: `creatures (minSize, includeFortress) | water ≥ n | magma ≥ n`). */
const PLATE_ROWS: readonly { readonly id: string; readonly kind: 'creatures' | 'water' | 'magma'; readonly includeFortress?: boolean }[] = [
  { id: 'enemies', kind: 'creatures', includeFortress: false },
  { id: 'anyone', kind: 'creatures', includeFortress: true },
  { id: 'water', kind: 'water' },
  { id: 'magma', kind: 'magma' },
];

type Tone = 'text' | 'dim' | 'value' | 'key' | 'alert' | 'good';

/** One line of the panel. A line with `run` takes the cursor, `Enter` and a click. */
export interface BuildingLine {
  /** A stable name for the line (`mode:locked`, `link`, `target:12`), for the tests. */
  readonly id: string;
  readonly text: string;
  readonly tone?: Tone;
  /** The accelerator letter the line shows. */
  readonly key?: string;
  /** What the status of the cursor's line explains, drawn under the list. */
  readonly help?: string;
  run?(): void;
  /** Cells of the line that act on their own (the priority digits). */
  readonly cells?: readonly { readonly from: number; readonly cols: number; run(): void }[];
}

interface Trigger {
  readonly kind: 'creatures' | 'water' | 'magma';
  readonly minSize: number;
  readonly includeFortress: boolean;
  readonly level: number;
}

export class BuildingPanel {
  /** The building the panel shows. */
  id: EntityId = 0;
  /** `link`: choosing a link target; `owner`: choosing an owner. */
  mode: 'main' | 'link' | 'owner' = 'main';
  readonly list: ListState = { selected: 0, scroll: 0 };
  /** The cursor of the target and owner choosers. */
  readonly pick: ListState = { selected: 0, scroll: 0 };

  open(id: EntityId): void {
    this.id = id;
    this.mode = 'main';
    this.list.selected = 0;
    this.list.scroll = 0;
    this.pick.selected = 0;
    this.pick.scroll = 0;
  }

  get linking(): boolean {
    return this.mode === 'link';
  }

  get choosing(): boolean {
    return this.mode === 'owner';
  }

  /** `Esc`: leave a chooser. Returns whether one was open. */
  cancel(): boolean {
    if (this.mode === 'main') return false;
    this.mode = 'main';
    return true;
  }

  private view(ctx: PanelContext): BuildingView | undefined {
    return buildings(ctx)?.get(this.id);
  }

  /** The function tags of a building (`buildings-and-furniture.md`). */
  tags(ctx: PanelContext, id: EntityId = this.id): readonly string[] {
    const reader = buildings(ctx);
    const view = reader?.get(id);
    if (reader === null || view === undefined) return [];
    return reader.types().find((row) => row.id === view.typeId)?.tags ?? [];
  }

  private name(ctx: PanelContext, id: EntityId = this.id): string {
    return buildingName(ctx, id);
  }

  private say(ctx: PanelContext, key: string, params: Readonly<Record<string, string | number>> = {}): void {
    ctx.notice?.(ctx.strings.get(key, params));
  }

  /** The words of the linkable kinds, for the messages ("a door, hatch, floodgate, …"). */
  private linkableWords(ctx: PanelContext): string {
    return ctx.strings.get('ui.building.linkable');
  }

  // ---------- doors, hatches, traps ----------

  /** `SetDoorMode` / `SetHatchMode` / `SetTrapMode` for the panel's building. */
  setMode(ctx: PanelContext, mode: string): Command | null {
    const view = this.view(ctx);
    const tags = this.tags(ctx);
    if (view === undefined) return null;
    if (view.state !== 'built') { this.say(ctx, 'ui.building.not_built', { building: this.name(ctx) }); return null; }
    let cmd: Command | null = null;
    let current = view.mode;
    if (tags.includes('door')) cmd = { type: 'SetDoorMode', buildingId: this.id, mode };
    else if (tags.includes('hatch')) cmd = { type: 'SetHatchMode', buildingId: this.id, mode };
    else if (tags.some((tag) => tag.startsWith('trap:'))) {
      cmd = { type: 'SetTrapMode', trapId: this.id, mode };
      current = this.trapMode(ctx) ?? '';
    }
    if (cmd === null) { this.say(ctx, 'ui.building.no_modes', { building: this.name(ctx) }); return null; }
    const word = ctx.strings.get(`ui.building.mode.${mode}`);
    if (current === mode) { this.say(ctx, 'ui.building.mode_already', { building: this.name(ctx), mode: word }); return null; }
    ctx.submit(cmd);
    this.say(ctx, 'ui.building.mode_set', { building: this.name(ctx), mode: word });
    return cmd;
  }

  private defense(ctx: PanelContext): DefenseReader | null {
    return ctx.readers.has('19') ? ctx.readers.of<DefenseReader>('19') : null;
  }

  private trapMode(ctx: PanelContext): string | null {
    return this.defense(ctx)?.trapMode(this.id) ?? null;
  }

  // ---------- levers and plates ----------

  /** `PullLever`. */
  pull(ctx: PanelContext): Command | null {
    const view = this.view(ctx);
    if (view === undefined || !this.tags(ctx).includes('lever')) return null;
    if (view.state !== 'built') { this.say(ctx, 'ui.building.not_built', { building: this.name(ctx) }); return null; }
    const cmd: Command = { type: 'PullLever', leverId: this.id };
    ctx.submit(cmd);
    this.say(ctx, view.linkedIds.length === 0 ? 'ui.building.pull_unlinked' : 'ui.building.pull', { building: this.name(ctx) });
    return cmd;
  }

  /** The buildings this lever or plate could be linked to now, ascending. */
  candidates(ctx: PanelContext): EntityId[] {
    const reader = buildings(ctx);
    const view = this.view(ctx);
    if (reader === null || view === undefined) return [];
    const out = new Set<EntityId>();
    for (const tag of LINKABLE_TAGS) for (const id of reader.byTag(tag)) {
      if (id !== this.id && !view.linkedIds.includes(id) && reader.get(id)?.state === 'built') out.add(id);
    }
    return Array.from(out).sort((a, b) => a - b);
  }

  /** `[i] link`: start choosing the target, on the map or in the list. */
  startLink(ctx: PanelContext): boolean {
    const view = this.view(ctx);
    const tags = this.tags(ctx);
    if (view === undefined || !(tags.includes('lever') || tags.includes('plate'))) return false;
    if (view.state !== 'built') { this.say(ctx, 'ui.building.not_built', { building: this.name(ctx) }); return false; }
    if (this.candidates(ctx).length === 0) { this.say(ctx, 'ui.building.link_none', { kinds: this.linkableWords(ctx) }); return false; }
    this.mode = 'link';
    this.pick.selected = 0;
    this.pick.scroll = 0;
    return true;
  }

  /** `LinkMechanism` to a target, or the reason it cannot be one. */
  linkTo(ctx: PanelContext, targetId: EntityId): Command | null {
    const reader = buildings(ctx);
    const view = this.view(ctx);
    const target = reader?.get(targetId);
    if (reader === null || view === undefined) return null;
    const source = this.name(ctx);
    if (target === undefined) { this.say(ctx, 'ui.building.link_nothing', { kinds: this.linkableWords(ctx) }); return null; }
    const name = this.name(ctx, targetId);
    if (targetId === this.id) { this.say(ctx, 'ui.building.link_self', { building: source }); return null; }
    if (!this.tags(ctx, targetId).some((tag) => LINKABLE_TAGS.includes(tag))) { this.say(ctx, 'ui.building.link_bad', { target: name, kinds: this.linkableWords(ctx) }); return null; }
    if (target.state !== 'built') { this.say(ctx, 'ui.building.not_built', { building: name }); return null; }
    if (view.linkedIds.includes(targetId)) { this.say(ctx, 'ui.building.link_already', { building: source, target: name }); return null; }
    const cmd: Command = { type: 'LinkMechanism', sourceId: this.id, targetId };
    ctx.submit(cmd);
    this.mode = 'main';
    // "mechanism available (blocks otherwise)": say so now, with where a mechanism comes from.
    const it = items(ctx);
    const types = reader.inputTypes('mechanism');
    const have = it === null || types.length === 0 ? 0 : it.countAvailable({ types });
    if (have > 0) this.say(ctx, 'ui.building.link_sent', { building: source, target: name });
    else this.say(ctx, 'ui.building.link_waits', { building: source, target: name, where: whereMade(ctx.registry, ['mechanism']) || ctx.strings.get('ui.build.stock.a_workshop') });
    return cmd;
  }

  /** A click on the map while choosing a link target. */
  pickAt(ctx: PanelContext, tile: TileIndex): Command | null {
    const id = buildings(ctx)?.at(tile) ?? 0;
    if (id === 0) { this.say(ctx, 'ui.building.link_nothing', { kinds: this.linkableWords(ctx) }); return null; }
    return this.linkTo(ctx, id);
  }

  /** `UnlinkMechanism` for a linked target. */
  unlink(ctx: PanelContext, targetId: EntityId): Command | null {
    const view = this.view(ctx);
    if (view === undefined) return null;
    if (view.linkedIds.length === 0) { this.say(ctx, 'ui.building.unlink_none', { building: this.name(ctx) }); return null; }
    if (!view.linkedIds.includes(targetId)) { this.say(ctx, 'ui.building.unlink_choose'); return null; }
    const cmd: Command = { type: 'UnlinkMechanism', sourceId: this.id, targetId };
    ctx.submit(cmd);
    this.say(ctx, 'ui.building.unlinked', { building: this.name(ctx), target: this.name(ctx, targetId) });
    return cmd;
  }

  /** The plate's trigger as stored, with the defaults 19 applies to a plate that has none. */
  trigger(ctx: PanelContext): Trigger {
    const raw = this.view(ctx)?.settings['triggerOn'] as Partial<Trigger> | undefined;
    const kind = raw?.kind === 'water' || raw?.kind === 'magma' ? raw.kind : 'creatures';
    return { kind, minSize: typeof raw?.minSize === 'number' ? raw.minSize : 0, includeFortress: raw?.includeFortress === true, level: typeof raw?.level === 'number' ? raw.level : 1 };
  }

  /** The row of {@link PLATE_ROWS} the plate's trigger is. */
  triggerRow(ctx: PanelContext): string {
    const t = this.trigger(ctx);
    return t.kind === 'creatures' ? (t.includeFortress ? 'anyone' : 'enemies') : t.kind;
  }

  private sendTrigger(ctx: PanelContext, t: Trigger): Command | null {
    if (!this.tags(ctx).includes('plate')) return null;
    const trigger = t.kind === 'creatures' ? { kind: t.kind, minSize: t.minSize, includeFortress: t.includeFortress } : { kind: t.kind, level: t.level };
    const cmd: Command = { type: 'SetPlateTrigger', plateId: this.id, trigger };
    ctx.submit(cmd);
    return cmd;
  }

  /** `SetPlateTrigger` to one of the panel's rows, keeping the size or depth. */
  setTrigger(ctx: PanelContext, row: string): Command | null {
    const spec = PLATE_ROWS.find((r) => r.id === row);
    if (spec === undefined) return null;
    if (row === this.triggerRow(ctx)) { this.say(ctx, 'ui.building.trigger_already'); return null; }
    const now = this.trigger(ctx);
    const cmd = this.sendTrigger(ctx, { ...now, kind: spec.kind, includeFortress: spec.includeFortress === true });
    if (cmd !== null) this.say(ctx, 'ui.building.trigger_set', { building: this.name(ctx), trigger: ctx.strings.get(`ui.building.trigger.${row}`) });
    return cmd;
  }

  /** `←` `→`: the smallest size (creatures) or the depth (water, magma) the plate answers to. */
  stepTrigger(ctx: PanelContext, delta: number): Command | null {
    const now = this.trigger(ctx);
    if (now.kind === 'creatures') {
      const minSize = Math.max(0, Math.min(PLATE_SIZE_MAX, now.minSize + delta * PLATE_SIZE_STEP));
      if (minSize === now.minSize) { this.say(ctx, 'ui.building.trigger_limit'); return null; }
      return this.sendTrigger(ctx, { ...now, minSize });
    }
    const level = Math.max(1, Math.min(PLATE_LEVEL_MAX, now.level + delta));
    if (level === now.level) { this.say(ctx, 'ui.building.trigger_limit'); return null; }
    return this.sendTrigger(ctx, { ...now, level });
  }

  // ---------- cages ----------

  /** The creature in the cage, or 0. */
  occupant(ctx: PanelContext): EntityId {
    const id = buildings(ctx)?.cageOccupant(this.id) ?? 0;
    return id !== 0 && ctx.readers.entities.has(id, C.Creature) ? id : 0;
  }

  private creatureName(ctx: PanelContext, id: EntityId): string {
    const creature = ctx.readers.entities.get(id, C.Creature);
    if (creature === undefined) return '';
    // An animal is named after its species until the player names it: "a wolf".
    const species = ctx.registry.table<{ id: string; name: string }>('creatures').byIndex(creature.species);
    if (creature.name !== '' && creature.name !== species?.name) return creature.name;
    return species === undefined ? '' : `a ${species.name}`;
  }

  /** `ReleaseCage`, after `c_release_cage`. */
  release(ctx: PanelContext): void {
    const occupant = this.occupant(ctx);
    if (occupant === 0) { this.say(ctx, 'ui.building.cage_empty', { building: this.name(ctx) }); return; }
    const id = this.id;
    confirmThen(ctx, 'c_release_cage', { creature: this.creatureName(ctx, occupant), cage: this.name(ctx) }, () => ctx.submit({ type: 'ReleaseCage', cageBuildingId: id }));
  }

  /** `TameCaged`. */
  tame(ctx: PanelContext): Command | null {
    const occupant = this.occupant(ctx);
    if (occupant === 0) { this.say(ctx, 'ui.building.cage_empty', { building: this.name(ctx) }); return null; }
    const cmd: Command = { type: 'TameCaged', cageId: this.id };
    ctx.submit(cmd);
    this.say(ctx, 'ui.building.tame_sent', { creature: this.creatureName(ctx, occupant) });
    return cmd;
  }

  // ---------- owners ----------

  /** The bedroom zone a bed stands in, or 0. */
  bedroom(ctx: PanelContext): EntityId {
    const reader = buildings(ctx);
    const view = this.view(ctx);
    if (reader === null || view === undefined) return 0;
    return reader.zonesAt(view.origin).find((zone) => reader.zone(zone)?.type === 'bedroom') ?? 0;
  }

  /** The owner of the bed's bedroom or of the coffin, or 0. */
  owner(ctx: PanelContext): EntityId {
    const tags = this.tags(ctx);
    if (tags.includes('coffin')) return this.view(ctx)?.ownerId ?? 0;
    const zone = this.bedroom(ctx);
    return zone === 0 ? 0 : buildings(ctx)?.ownerOf(zone) ?? 0;
  }

  private coffinTaken(ctx: PanelContext): boolean {
    return ((this.view(ctx)?.settings['occupantId'] as number | undefined) ?? 0) !== 0;
  }

  /** `[w] owner`: open the list of dwarves, or say why there is no owner to choose. */
  startOwner(ctx: PanelContext): boolean {
    const view = this.view(ctx);
    const tags = this.tags(ctx);
    if (view === undefined || !(tags.includes('sleep') || tags.includes('coffin'))) return false;
    if (view.state !== 'built') { this.say(ctx, 'ui.building.not_built', { building: this.name(ctx) }); return false; }
    if (tags.includes('coffin') && this.coffinTaken(ctx)) { this.say(ctx, 'ui.building.coffin_taken', { building: this.name(ctx) }); return false; }
    if (tags.includes('sleep') && this.bedroom(ctx) === 0) { this.say(ctx, 'ui.building.no_bedroom', { building: this.name(ctx) }); return false; }
    this.mode = 'owner';
    const owner = this.owner(ctx);
    this.pick.selected = owner === 0 ? 0 : Math.max(0, dwarvesOf(ctx).indexOf(owner) + 1);
    this.pick.scroll = 0;
    return true;
  }

  /** `AssignRoom` (a bed's bedroom) or `AssignCoffin`; dwarf 0 is nobody. */
  assign(ctx: PanelContext, dwarfId: EntityId): Command | null {
    const tags = this.tags(ctx);
    let cmd: Command;
    if (tags.includes('coffin')) {
      if (this.coffinTaken(ctx)) { this.say(ctx, 'ui.building.coffin_taken', { building: this.name(ctx) }); return null; }
      cmd = { type: 'AssignCoffin', coffinId: this.id, dwarfId };
    } else if (tags.includes('sleep')) {
      const zoneId = this.bedroom(ctx);
      if (zoneId === 0) { this.say(ctx, 'ui.building.no_bedroom', { building: this.name(ctx) }); return null; }
      cmd = { type: 'AssignRoom', zoneId, dwarfId };
    } else return null;
    ctx.submit(cmd);
    this.mode = 'main';
    if (dwarfId === 0) this.say(ctx, 'ui.building.owner_cleared', { building: this.name(ctx) });
    else this.say(ctx, 'ui.building.owner_set', { building: this.name(ctx), dwarf: nameOf(ctx, dwarfId) });
    return cmd;
  }

  // ---------- planned buildings ----------

  /** `SetBuildingPriority`. */
  setPriority(ctx: PanelContext, priority: number): Command | null {
    const view = this.view(ctx);
    if (view === undefined) return null;
    if (view.state !== 'planned') { this.say(ctx, 'ui.building.priority_planned'); return null; }
    const p = Math.max(PRIORITY_MIN, Math.min(PRIORITY_MAX, priority));
    const cmd: Command = { type: 'SetBuildingPriority', buildingId: this.id, priority: p };
    ctx.submit(cmd);
    this.say(ctx, 'ui.building.priority_set', { building: this.name(ctx), n: p });
    return cmd;
  }

  /** Why a planned building waits ("waiting: 1 door — order at a carpenter's workshop"), or ''. */
  waiting(ctx: PanelContext): string {
    if (!ctx.readers.has('11')) return '';
    const job = ctx.readers.of<JobsReader>('11').byKey(`build:${this.id}`);
    if (job === undefined || job.state !== 'blocked' || job.blockedReason === null) return '';
    return capitalize(jobBlockText(ctx, job).long);
  }

  // ---------- the lines ----------

  /** The panel's lines for its state now. `takeApart` is the screen's confirmed deconstruct. */
  lines(ctx: PanelContext, takeApart?: (id: EntityId) => void): BuildingLine[] {
    const reader = buildings(ctx);
    const view = this.view(ctx);
    const s = ctx.strings;
    if (reader === null || view === undefined) return [{ id: 'gone', text: s.get('ui.building.gone'), tone: 'dim' }];
    const letters = ctx.panelLetters;
    const key = (letter: string, caption: string): string => `${acceleratorLabel(letter, letters)} ${caption}`;
    const out: BuildingLine[] = [];
    const name = this.name(ctx);
    if (this.mode === 'link') {
      out.push({ id: 'title', text: s.get('ui.building.link_title', { building: name }), tone: 'value' });
      for (const id of this.candidates(ctx)) {
        const state = reader.mechanismState(id);
        out.push({ id: `candidate:${id}`, text: state === '' ? this.name(ctx, id) : s.get('ui.building.target', { target: this.name(ctx, id), state: s.get(`ui.building.state.${state}`) }), run: () => void this.linkTo(ctx, id), help: s.get('ui.building.link_help') });
      }
      return out;
    }
    if (this.mode === 'owner') {
      const owner = this.owner(ctx);
      const mark = (id: EntityId): string => (id === owner ? '● ' : '○ ');
      out.push({ id: 'title', text: s.get('ui.building.owner_title', { building: name }), tone: 'value' });
      out.push({ id: 'owner:0', text: `${mark(0)}${s.get('ui.building.nobody')}`, run: () => void this.assign(ctx, 0), help: s.get('ui.building.owner_help') });
      for (const id of dwarvesOf(ctx)) out.push({ id: `owner:${id}`, text: `${mark(id)}${nameOf(ctx, id)}`, run: () => void this.assign(ctx, id), help: s.get('ui.building.owner_help') });
      return out;
    }
    const tags = this.tags(ctx);
    const material = ctx.registry.table<{ id: string; name: string }>('materials').byIndex(view.material)?.name ?? '';
    const doomed = view.settings['deconstruct'] === true;
    const state = s.get(doomed ? 'ui.building.state.doomed' : `ui.building.state.${view.state}`);
    out.push({ id: 'title', text: name, tone: 'value' });
    out.push({ id: 'state', text: material === '' ? state : `${capitalize(material)} · ${state}`, tone: view.state === 'built' && !doomed ? 'text' : 'alert' });
    if (view.state !== 'built') {
      const waiting = this.waiting(ctx);
      if (waiting !== '') out.push({ id: 'waiting', text: waiting, tone: 'alert' });
      if (view.state === 'planned') {
        const priority = (view.settings['priority'] as number | undefined) ?? PRIORITY_DEFAULT;
        const head = s.get('ui.building.priority', { n: priority });
        const cells = [];
        for (let p = PRIORITY_MIN; p <= PRIORITY_MAX; p += 1) cells.push({ from: Array.from(head).length + 1 + (p - PRIORITY_MIN) * 2, cols: 2, run: () => void this.setPriority(ctx, p) });
        const digits = cells.map((_, k) => String(PRIORITY_MIN + k)).join(' ');
        out.push({ id: 'priority', text: `${head} ${digits}`, cells, help: s.get('ui.building.priority_help') });
      }
      out.push({ id: 'cancel', text: key('x', s.get('ui.building.cancel')), key: 'x', run: () => ctx.submit({ type: 'CancelBuilding', buildingId: this.id }) });
      return out;
    }
    // Doors, hatches and traps: the mode as a list, the current one marked.
    const trap = tags.some((tag) => tag.startsWith('trap:'));
    const modes = tags.includes('door') ? DOOR_MODE_ROWS : tags.includes('hatch') ? HATCH_MODE_ROWS : trap ? TRAP_MODE_ROWS : [];
    if (modes.length > 0) {
      const current = trap ? this.trapMode(ctx) ?? 'enemies' : view.mode;
      if (trap) {
        const status = this.defense(ctx)?.trapState(this.id) ?? null;
        if (status !== null) out.push({ id: 'trap', text: s.get('ui.building.trap_state', { state: s.get(`ui.building.state.${status}`) }), tone: status === 'armed' ? 'good' : 'alert' });
      } else if (tags.includes('door') && current === 'lock_on_alert') {
        out.push({ id: 'alert', text: s.get(reader.mechanismState(this.id) === 'locked' ? 'ui.building.alert_locked' : 'ui.building.alert_open'), tone: 'dim' });
      }
      out.push({ id: 'modes', text: s.get('ui.building.modes'), tone: 'key' });
      for (const mode of modes) {
        out.push({ id: `mode:${mode}`, text: `${mode === current ? '●' : '○'} ${s.get(`ui.building.mode.${mode}`)}`, run: () => void this.setMode(ctx, mode), help: s.get(`ui.building.mode_help.${mode}`) });
      }
    }
    if (tags.includes('lever')) {
      out.push({ id: 'lever', text: s.get('ui.building.lever_state', { state: s.get(`ui.building.state.${view.toggled ? 'on' : 'off'}`) }) });
      out.push({ id: 'pull', text: key('y', s.get('ui.building.pull_caption')), key: 'y', run: () => void this.pull(ctx), help: s.get('ui.building.pull_help') });
    }
    if (tags.includes('plate')) {
      const t = this.trigger(ctx);
      const row = this.triggerRow(ctx);
      const active = this.defense(ctx)?.plateActive(this.id) === true;
      out.push({ id: 'plate', text: s.get(active ? 'ui.building.plate_down' : 'ui.building.plate_up'), tone: active ? 'alert' : 'text' });
      out.push({ id: 'triggers', text: s.get('ui.building.triggers'), tone: 'key' });
      for (const spec of PLATE_ROWS) {
        out.push({ id: `trigger:${spec.id}`, text: `${spec.id === row ? '●' : '○'} ${s.get(`ui.building.trigger.${spec.id}`)}`, run: () => void this.setTrigger(ctx, spec.id), help: s.get('ui.building.trigger_help') });
      }
      out.push({
        id: 'amount',
        text: t.kind === 'creatures' ? s.get('ui.building.trigger_size', { n: t.minSize }) : s.get('ui.building.trigger_level', { n: t.level, max: PLATE_LEVEL_MAX }),
        help: s.get('ui.building.trigger_help'),
        cells: [{ from: 0, cols: 1, run: () => void this.stepTrigger(ctx, -1) }, { from: 2, cols: 1, run: () => void this.stepTrigger(ctx, 1) }],
      });
    }
    if (tags.includes('lever') || tags.includes('plate')) {
      out.push({ id: 'links', text: s.get('ui.building.links', { n: view.linkedIds.length }), tone: 'key' });
      for (const target of view.linkedIds) {
        const origin = reader.get(target)?.origin;
        const mech = reader.mechanismState(target);
        out.push({
          id: `target:${target}`,
          text: `→ ${mech === '' ? this.name(ctx, target) : s.get('ui.building.target', { target: this.name(ctx, target), state: s.get(`ui.building.state.${mech}`) })}`,
          run: () => { if (origin !== undefined) ctx.focusOn(origin); },
          help: s.get('ui.building.target_help'),
        });
      }
      for (const pending of this.pendingLinks(ctx)) out.push({ id: `pending:${pending.target}`, text: `… ${this.name(ctx, pending.target)}: ${pending.text}`, tone: 'dim' });
      out.push({ id: 'link', text: key('i', s.get('ui.building.link_caption')), key: 'i', run: () => void this.startLink(ctx), help: s.get('ui.building.link_caption_help', { kinds: this.linkableWords(ctx) }) });
      if (view.linkedIds.length > 0) out.push({ id: 'unlink', text: key('r', s.get('ui.building.unlink_caption')), key: 'r', run: () => void this.unlink(ctx, this.cursorTarget(ctx)), help: s.get('ui.building.unlink_help') });
    } else if (view.linkedIds.length > 0) {
      // A target: what works it.
      out.push({ id: 'links', text: s.get('ui.building.linked_from'), tone: 'key' });
      for (const source of view.linkedIds) {
        const origin = reader.get(source)?.origin;
        out.push({ id: `source:${source}`, text: `← ${this.name(ctx, source)}`, run: () => { if (origin !== undefined) ctx.focusOn(origin); }, help: s.get('ui.building.target_help') });
      }
    }
    if (tags.includes('cage')) {
      const occupant = this.occupant(ctx);
      out.push({ id: 'cage', text: occupant === 0 ? s.get('ui.building.cage_holds_none') : s.get('ui.building.cage_holds', { creature: this.creatureName(ctx, occupant) }), tone: occupant === 0 ? 'dim' : 'value' });
      out.push({ id: 'release', text: key('r', s.get('ui.building.release_caption')), key: 'r', run: () => this.release(ctx), help: s.get('ui.building.release_help') });
      out.push({ id: 'tame', text: key('g', s.get('ui.building.tame_caption')), key: 'g', run: () => void this.tame(ctx), help: s.get('ui.building.tame_help') });
    }
    if (tags.includes('sleep') || tags.includes('coffin')) {
      const coffin = tags.includes('coffin');
      const owner = this.owner(ctx);
      const zone = coffin ? 0 : this.bedroom(ctx);
      let text: string;
      if (coffin && this.coffinTaken(ctx)) text = s.get('ui.building.coffin_holds');
      else if (!coffin && zone === 0) text = s.get('ui.building.owner_no_bedroom');
      else if (owner === 0) text = s.get(coffin ? 'ui.building.coffin_anyone' : 'ui.building.owner_none', { zone: zoneName(ctx, zone) });
      else text = s.get(coffin ? 'ui.building.coffin_for' : 'ui.building.owner_is', { dwarf: nameOf(ctx, owner), zone: zoneName(ctx, zone) });
      out.push({ id: 'owner', text, tone: owner === 0 ? 'dim' : 'value' });
      out.push({ id: 'choose', text: key('w', s.get(coffin ? 'ui.building.coffin_caption' : 'ui.building.owner_caption')), key: 'w', run: () => void this.startOwner(ctx), help: s.get(coffin ? 'ui.building.coffin_help' : 'ui.building.owner_caption_help') });
    }
    out.push({ id: 'look', text: s.get('ui.building.look'), run: () => ctx.look(view.origin), help: s.get('ui.building.look_help') });
    if (takeApart !== undefined && !doomed) out.push({ id: 'take_apart', text: key('x', s.get('ui.building.take_apart')), key: 'x', run: () => takeApart(this.id), help: s.get('ui.building.take_apart_help') });
    return out;
  }

  /** The links a mechanic has still to make from this lever or plate. */
  private pendingLinks(ctx: PanelContext): { target: EntityId; text: string }[] {
    if (!ctx.readers.has('11')) return [];
    const prefix = `link_mechanism:${this.id}:`;
    const seen = new Set<EntityId>();
    const out: { target: EntityId; text: string }[] = [];
    for (const job of ctx.readers.of<JobsReader>('11').list()) {
      if (!job.key.startsWith(prefix)) continue;
      const target = Number(job.key.slice(prefix.length).split(':')[0]);
      if (!Number.isFinite(target) || seen.has(target)) continue;
      seen.add(target);
      out.push({ target, text: job.state === 'blocked' && job.blockedReason !== null ? jobBlockText(ctx, job).short : ctx.strings.get('ui.building.link_pending') });
    }
    return out;
  }

  /** The linked target `[r] unlink` means: the cursor's, or the only one. */
  private cursorTarget(ctx: PanelContext): EntityId {
    const view = this.view(ctx);
    const line = this.selectable(this.lines(ctx))[this.list.selected];
    if (line !== undefined && line.id.startsWith('target:')) return Number(line.id.slice('target:'.length));
    return view !== undefined && view.linkedIds.length === 1 ? (view.linkedIds[0] as EntityId) : 0;
  }

  private selectable(lines: readonly BuildingLine[]): BuildingLine[] {
    return lines.filter((line) => line.run !== undefined);
  }

  private cursor(): ListState {
    return this.mode === 'main' ? this.list : this.pick;
  }

  /** The line a test or a key means, by its id. Returns whether it ran. */
  activate(ctx: PanelContext, id: string, takeApart?: (id: EntityId) => void): boolean {
    const line = this.lines(ctx, takeApart).find((l) => l.id === id);
    if (line?.run === undefined) return false;
    line.run();
    return true;
  }

  /** The panel's keys: `↑` `↓` `Enter`, the accelerators, `1`–`9` (priority), `←` `→` (a plate's size or depth). */
  key(ctx: PanelContext, press: KeyPress, takeApart?: (id: EntityId) => void): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    const k = press.key;
    const lines = this.lines(ctx, takeApart);
    const rows = this.selectable(lines);
    const cursor = this.cursor();
    cursor.selected = Math.max(0, Math.min(rows.length - 1, cursor.selected));
    const up = k === 'ArrowUp' || k === '↑';
    const down = k === 'ArrowDown' || k === '↓';
    if (!press.shift && (up || down)) {
      if (rows.length === 0) return true;
      cursor.selected = Math.max(0, Math.min(rows.length - 1, cursor.selected + (up ? -1 : 1)));
      // Choosing a target: the map follows the cursor, so the player sees which door it is.
      const line = rows[cursor.selected];
      if (this.mode === 'link' && line !== undefined) {
        const origin = buildings(ctx)?.get(Number(line.id.slice('candidate:'.length)))?.origin;
        if (origin !== undefined) ctx.focusOn(origin);
      }
      return true;
    }
    if (k === 'Enter') {
      rows[cursor.selected]?.run?.();
      return true;
    }
    if (this.mode !== 'main') return false;
    const view = this.view(ctx);
    if (view?.state === 'planned' && /^[1-9]$/.test(k)) {
      this.setPriority(ctx, Number(k));
      return true;
    }
    const left = k === 'ArrowLeft' || k === '←';
    const right = k === 'ArrowRight' || k === '→';
    if (!press.shift && (left || right) && view?.state === 'built' && this.tags(ctx).includes('plate')) {
      this.stepTrigger(ctx, left ? -1 : 1);
      return true;
    }
    const letter = accel(ctx, press);
    if (letter === '') return false;
    const line = lines.find((l) => l.key === letter && l.run !== undefined);
    if (line === undefined) return false;
    line.run?.();
    return true;
  }
}

/** Rows kept under the list for the cursor line's explanation. */
const HELP_ROWS = 3;

/** Rows a line without an action may wrap to. */
const WRAP_ROWS = 3;

/** The panel body (the title row is the sidebar's). */
export function drawBuildingPanel(s: Surface, rect: Rect, panel: BuildingPanel, ctx: PanelContext, takeApart?: (id: EntityId) => void): void {
  const t = s.theme;
  const tones: Record<Tone, typeof t.text> = { text: t.text, dim: t.dim, value: t.value, key: t.key, alert: t.alert, good: t.good };
  const lines = panel.lines(ctx, takeApart);
  const cursor = panel.mode === 'main' ? panel.list : panel.pick;
  const rows = lines.filter((line) => line.run !== undefined);
  cursor.selected = Math.max(0, Math.min(Math.max(0, rows.length - 1), cursor.selected));
  const chosen = rows[cursor.selected];
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const height = Math.max(1, rect.rows - HELP_ROWS - 1);
  // A line that says something (no action) wraps; an action keeps to one row.
  const shown: { line: BuildingLine; text: string; first: boolean }[] = [];
  for (const line of lines) {
    const parts = line.run === undefined && line.cells === undefined ? wrapText(line.text, width, WRAP_ROWS) : [line.text];
    parts.forEach((text, k) => shown.push({ line, text, first: k === 0 }));
  }
  const at = chosen === undefined ? 0 : shown.findIndex((entry) => entry.line === chosen);
  // Keep the cursor's line in view.
  if (at < cursor.scroll) cursor.scroll = at;
  if (at >= cursor.scroll + height) cursor.scroll = at - height + 1;
  cursor.scroll = Math.max(0, Math.min(Math.max(0, shown.length - height), cursor.scroll));
  for (let r = 0; r < height; r += 1) {
    const entry = shown[cursor.scroll + r];
    if (entry === undefined) break;
    const line = entry.line;
    const row = rect.row + r;
    const n = label(s, col, row, entry.text, { fg: tones[line.tone ?? 'text'], width });
    if (line.run !== undefined) {
      const index = rows.indexOf(line);
      if (line === chosen) s.invert({ col, row, cols: Math.max(n, 1), rows: 1 });
      const run = line.run.bind(line);
      s.hit({ col, row, cols: width, rows: 1 }, () => { cursor.selected = index; run(); });
    }
    for (const cell of line.cells ?? []) s.hit({ col: col + cell.from, row, cols: cell.cols, rows: 1 }, () => cell.run());
  }
  const help = chosen?.help ?? lines.find((line) => line.help !== undefined && line.run === undefined)?.help;
  if (help === undefined) return;
  const top = rect.row + rect.rows - HELP_ROWS;
  wrapText(help, width, HELP_ROWS).forEach((text, k) => label(s, col, top + k, text, { fg: t.dim, width }));
}
