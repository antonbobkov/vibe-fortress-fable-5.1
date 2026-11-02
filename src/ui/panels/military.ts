/**
 * Military panel: squads, alert selector, duty and orders (`ui-screens/panels.md` § Military).
 * Spec: 16 § Squads, § Alerts, § Kills and loot; 24 § alert selector.
 *
 * U-06 (UI audit M11, § 3 "Add 6 dwarves to a squad"): the member list is a multi-select (`Space`
 * marks, `*` all, `Enter` commits every marked dwarf in one `SetSquadMembers`; with none marked
 * `Enter` takes the cursor's row). `[S-l]` picks the leader among the members (`SetSquadLeader`),
 * `[S-b]` assigns a barracks zone (`SetZoneSetting { key: 'squad' }`), `[S-n]` renames the squad
 * through the `text_input` dialog (`RenameSquad`). The new keys avoid the panel hotkeys (D-U2).
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId, TileIndex, Alert } from '@core/types';
import { SQUAD_MAX_COUNT, SQUAD_MAX_SIZE, TICKS_PER_YEAR } from '@core/constants';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import type { Rect } from '@render/cellbuffer';
import type { CombatReader, SquadWithId } from '@systems/combat';
import type { Surface } from '../surface';
import { captionButtons, clampList, label, Marks, separator, table, type ListState } from '../widgets';
import { accel, type PanelContext } from './context';
import type { KeyPress } from '@platform/input';
import type { FortressHost } from '../screens/fortress';
import { creaturesAt } from './look';
import { militaryNoSquad, wrapText, zoneName } from '../messages';
import { SQUAD_NAME_MAX_CHARS } from '../constants';
import type { BuildingsReader } from '@systems/buildings';
import { dwarvesOf } from './units';
import type { MagicReader } from '@systems/magic';
import { soldierTrigger } from '@systems/magic/draughts';

interface WeaponClassRow {
  readonly id: string;
  readonly weaponClass?: string;
  readonly launcher?: { readonly ammo?: string };
}

/**
 * The glyph of the channel a member holds, when the member can cast with it (a runecaster: 25
 * § Channels); '' otherwise. A channel is a launcher with no ammunition.
 */
export function channelMark(ctx: PanelContext, memberId: EntityId): string {
  if (!ctx.readers.has('25')) return '';
  const weapon = ctx.readers.entities.get(memberId, C.Equipment)?.weapon ?? 0;
  const runecraft = ctx.registry.table('skills').index('runecraft');
  const level = runecraft < 0 ? 0 : ctx.readers.entities.get(memberId, C.Skills)?.level[runecraft] ?? 0;
  if (weapon === 0 || level < 1) return '';
  if (ctx.readers.of<MagicReader>('25').spellOf(weapon) === undefined) return '';
  const item = ctx.readers.entities.get(weapon, C.Item);
  return item === undefined ? '' : ctx.registry.table<{ id: string; glyph?: string }>('items').byIndex(item.type)?.glyph ?? '';
}

export const SQUAD_PRESET_NAMES = [
  'The Hearthguard',
  'The Cold Bolts',
  'The Iron Shields',
  'The Deep Watchers',
  'The Stone Axes',
  'The Mountain Guard',
  'The Shadowbanes',
  'The Gatekeepers',
];

export function shortDwarfName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1 || !parts[1]) return fullName;
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

type ChoiceKind = 'add' | 'remove' | 'leader' | 'barracks' | 'weapon' | 'armor' | 'draughts';

export class MilitaryPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  settingStation = false;
  settingPatrol = false;
  settingKill = false;
  settingFollow = false;
  /**
   * The open list under the squad: dwarves to add or members to remove (both multi-select), the
   * leader among the members, or the barracks zone. A barracks row's id is a zone, 0 for "none".
   */
  memberChoice: { kind: ChoiceKind; selected: number; scroll: number; marks: Marks } | null = null;

  cancel(): void {
    this.settingStation = false;
    this.settingPatrol = false;
    this.settingKill = false;
    this.settingFollow = false;
    this.memberChoice = null;
  }

  /** Arm a pick (a station, a patrol point, a kill or follow order); with no squad it says so instead. */
  arm(ctx: PanelContext, kind: 'station' | 'patrol' | 'kill' | 'follow'): void {
    if (this.selectedSquad(ctx) === undefined) { ctx.notice?.(militaryNoSquad(ctx)); return; }
    this.cancel();
    if (kind === 'station') this.settingStation = true;
    else if (kind === 'patrol') this.settingPatrol = true;
    else if (kind === 'kill') this.settingKill = true;
    else this.settingFollow = true;
    ctx.clearNotice?.();
  }

  /** The key or click that sets the squad's mode; a mode of work with nobody in the squad says so. */
  changeMode(ctx: PanelContext, mode: 'off' | 'train' | 'active' | 'next', host?: FortressHost): boolean {
    const squad = this.selectedSquad(ctx);
    if (squad === undefined) { ctx.notice?.(militaryNoSquad(ctx)); return true; }
    const cmd = mode === 'next' ? this.cycleMode(ctx) : this.setMode(ctx, mode);
    if (cmd === null) return true;
    if (host !== undefined) host.submit(cmd);
    else ctx.submit(cmd);
    if (cmd.type === 'SetSquadMode' && cmd['mode'] !== 'off' && squad.members.length === 0) ctx.notice?.(ctx.strings.get('ui.military.mode_no_members', { squad: squad.name }));
    return true;
  }

  squads(ctx: PanelContext): readonly SquadWithId[] {
    if (!ctx.readers.has('16')) return [];
    return ctx.readers.of<CombatReader>('16').squads();
  }

  selectedSquad(ctx: PanelContext): SquadWithId | undefined {
    const list = this.squads(ctx);
    return list[this.list.selected] ?? list[0];
  }

  move(delta: number, ctx: PanelContext): void {
    const total = this.squads(ctx).length;
    if (total === 0) {
      this.list.selected = 0;
      return;
    }
    this.list.selected = Math.max(0, Math.min(total - 1, this.list.selected + delta));
  }

  newSquad(ctx: PanelContext): Command | null {
    const squads = this.squads(ctx);
    if (squads.length >= SQUAD_MAX_COUNT) return null;
    const usedNames = new Set(squads.map((s) => s.name));
    const name = SQUAD_PRESET_NAMES.find((n) => !usedNames.has(n)) ?? `Squad #${squads.length + 1}`;
    return { type: 'CreateSquad', name };
  }

  disbandSquad(ctx: PanelContext, host?: FortressHost): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    if (host?.confirm !== undefined) {
      host.confirm('c_disband_squad', { squad: squad.name }, (yes) => {
        if (yes) host.submit({ type: 'DisbandSquad', squadId: squad.id });
      });
      return null;
    }
    // Without a dialog to ask through (a bare test host) the command goes as asked (§4.1).
    return { type: 'DisbandSquad', squadId: squad.id };
  }

  addMember(ctx: PanelContext): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad || squad.members.length >= SQUAD_MAX_SIZE) return null;
    const allSquads = this.squads(ctx);
    const assigned = new Set(allSquads.flatMap((s) => s.members));
    for (const id of dwarvesOf(ctx)) {
      if (assigned.has(id)) continue;
      const c = ctx.readers.entities.get(id, C.Creature);
      if (c && c.faction === 'fortress' && ctx.readers.entities.alive(id) && c.ageTicks >= ADULT_AGE_YEARS * TICKS_PER_YEAR) {
        return { type: 'SetSquadMembers', squadId: squad.id, members: [...squad.members, id] };
      }
    }
    return null;
  }

  removeMember(ctx: PanelContext): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad || squad.members.length === 0) return null;
    return { type: 'SetSquadMembers', squadId: squad.id, members: squad.members.slice(0, -1) };
  }

  cycleMode(ctx: PanelContext): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    const modes: ('off' | 'train' | 'active')[] = ['off', 'train', 'active'];
    const next = modes[(modes.indexOf(squad.mode) + 1) % modes.length] as 'off' | 'train' | 'active';
    return { type: 'SetSquadMode', squadId: squad.id, mode: next };
  }

  setMode(ctx: PanelContext, mode: 'off' | 'train' | 'active'): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    return { type: 'SetSquadMode', squadId: squad.id, mode };
  }

  /** The exact choices accepted by SetSquadEquipment; weapon classes come from content. */
  gearOptions(ctx: PanelContext, kind: 'weapon' | 'armor'): string[] {
    // A channel's class is not offered: a runecaster takes a channel whatever the squad prefers (25 § Channels).
    return kind === 'armor' ? ['any', 'metal', 'leather'] : ['any', ...new Set(ctx.registry.table<WeaponClassRow>('weapons').rows.flatMap((weapon) =>
      typeof weapon.weaponClass === 'string' && !(weapon.launcher !== undefined && weapon.launcher.ammo === undefined) ? [weapon.weaponClass] : []))];
  }

  /** 25 § Draughts: every draught a soldier drinks, in table order, for the squad's checklist. */
  draughtOptions(ctx: PanelContext): string[] {
    return ctx.registry.table<{ id: string; trigger: string }>('draughts').rows
      .filter((row) => row !== undefined && soldierTrigger(row.trigger)).map((row) => row.id);
  }

  /** The squad's list with one draught added at its end, or taken out. */
  toggleDraught(ctx: PanelContext, draughtId: string): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    const list = squad.equipment.draughts ?? [];
    const next = list.includes(draughtId) ? list.filter((d) => d !== draughtId) : [...list, draughtId];
    return { type: 'SetSquadEquipment', squadId: squad.id, equipment: { ...squad.equipment, draughts: next } };
  }

  toggleRanged(ctx: PanelContext): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    return { type: 'SetSquadEquipment', squadId: squad.id, equipment: { ...squad.equipment, ranged: !squad.equipment.ranged } };
  }

  clearStation(ctx: PanelContext): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    return { type: 'SetSquadStation', squadId: squad.id, tile: null };
  }

  /** Whether the squad can stand on a tile: the check the station and patrol commands make. */
  canStand(ctx: PanelContext, tile: TileIndex): boolean {
    return ctx.readers.pathing.passable(tile, 'walker');
  }

  /** Set the station; false when the tile cannot be stood on (nothing is sent, the pick stays armed). */
  setStation(ctx: PanelContext, tile: TileIndex, host?: FortressHost): boolean {
    const squad = this.selectedSquad(ctx);
    if (!squad) return true;
    if (!this.canStand(ctx, tile)) return false;
    if (host !== undefined) host.submit({ type: 'SetSquadStation', squadId: squad.id, tile });
    else ctx.submit({ type: 'SetSquadStation', squadId: squad.id, tile });
    return true;
  }

  /** Open one of the lists, or say why it would be empty (D-U4). */
  openChoice(ctx: PanelContext, kind: ChoiceKind): void {
    const squad = this.selectedSquad(ctx);
    const strings = ctx.strings;
    if (!squad) {
      ctx.notice?.(militaryNoSquad(ctx));
      return;
    }
    this.memberChoice = { kind, selected: kind === 'weapon' || kind === 'armor' ? Math.max(0, this.gearOptions(ctx, kind).indexOf(kind === 'weapon' ? squad.equipment.weaponClass : squad.equipment.armor)) : 0, scroll: 0, marks: new Marks() };
    let why: string | null = null;
    if (kind === 'add' && squad.members.length >= SQUAD_MAX_SIZE) why = strings.get('ui.military.squad_full', { squad: squad.name, max: SQUAD_MAX_SIZE });
    else if (kind === 'barracks' && this.barracksZones(ctx).length === 0) why = strings.get('ui.military.no_barracks');
    else if (kind === 'draughts' && this.draughtOptions(ctx).length === 0) why = strings.get('ui.military.no_draughts');
    else if (this.memberCandidates(ctx).length === 0) why = strings.get(kind === 'add' ? 'ui.military.no_candidates' : 'ui.military.no_members', { squad: squad.name });
    if (why !== null) {
      this.memberChoice = null;
      ctx.notice?.(why);
    }
  }

  /** Every barracks zone, in zone order. */
  barracksZones(ctx: PanelContext): EntityId[] {
    return ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14').zonesOfType('barracks') : [];
  }

  /** The barracks zone whose `squad` setting names this squad, or 0. */
  assignedBarracks(ctx: PanelContext, squadId: EntityId): EntityId {
    if (!ctx.readers.has('14')) return 0;
    const b = ctx.readers.of<BuildingsReader>('14');
    return this.barracksZones(ctx).find((z) => b.zone(z)?.settings['squad'] === squadId) ?? 0;
  }

  /** How many more dwarves the squad takes. */
  freeSlots(ctx: PanelContext): number {
    const squad = this.selectedSquad(ctx);
    return squad ? Math.max(0, SQUAD_MAX_SIZE - squad.members.length) : 0;
  }

  /** `Space` in an add or remove list: mark the row; an add list takes no more marks than free places. */
  toggleMark(ctx: PanelContext, index?: number): boolean {
    const choice = this.memberChoice;
    if (!choice || (choice.kind !== 'add' && choice.kind !== 'remove')) return false;
    const id = this.memberCandidates(ctx)[index ?? choice.selected];
    if (id === undefined) return true;
    if (choice.kind === 'add' && !choice.marks.has(id) && choice.marks.size >= this.freeSlots(ctx)) {
      ctx.notice?.(ctx.strings.get('ui.military.no_room', { free: this.freeSlots(ctx) }));
      return true;
    }
    choice.marks.toggle(id);
    return true;
  }

  /** `*`: mark every row (as many as the squad has room for), or none when that many are marked. */
  markAll(ctx: PanelContext): void {
    const choice = this.memberChoice;
    if (!choice || (choice.kind !== 'add' && choice.kind !== 'remove')) return;
    const rows = this.memberCandidates(ctx);
    const reach = choice.kind === 'add' ? rows.slice(0, this.freeSlots(ctx)) : rows;
    if (choice.marks.size >= reach.length) choice.marks.clear();
    else {
      choice.marks.clear();
      choice.marks.all(reach);
      if (reach.length < rows.length) ctx.notice?.(ctx.strings.get('ui.military.no_room', { free: reach.length }));
    }
  }

  /**
   * `Enter`: every marked row, or the cursor's with none marked. One `SetSquadMembers` for an add
   * or a remove; `SetSquadLeader`; or the `SetZoneSetting`s that move the squad's barracks.
   */
  commitChoice(ctx: PanelContext, index?: number): Command[] {
    const squad = this.selectedSquad(ctx);
    const choice = this.memberChoice;
    if (!squad || !choice) return [];
    const rows = this.memberCandidates(ctx);
    const at = rows[index ?? choice.selected];
    this.memberChoice = null;
    if (choice.kind === 'weapon' || choice.kind === 'armor') {
      const value = at === undefined ? undefined : this.gearOptions(ctx, choice.kind)[at];
      if (value === undefined) return [];
      return [{ type: 'SetSquadEquipment', squadId: squad.id, equipment: { ...squad.equipment, ...(choice.kind === 'weapon' ? { weaponClass: value } : { armor: value as 'any' | 'metal' | 'leather' }) } }];
    }
    if (choice.kind === 'draughts') {
      const draught = at === undefined ? undefined : this.draughtOptions(ctx)[at];
      const cmd = draught === undefined ? null : this.toggleDraught(ctx, draught);
      return cmd === null ? [] : [cmd];
    }
    if (choice.kind === 'leader') return at === undefined ? [] : [{ type: 'SetSquadLeader', squadId: squad.id, leaderId: at }];
    if (choice.kind === 'barracks') {
      if (at === undefined) return [];
      // One barracks per squad: the zone it had lets go, the chosen one (0: none) takes it.
      const out: Command[] = [];
      for (const zone of this.barracksZones(ctx)) {
        const b = ctx.readers.of<BuildingsReader>('14');
        if (zone !== at && b.zone(zone)?.settings['squad'] === squad.id) out.push({ type: 'SetZoneSetting', zoneId: zone, key: 'squad', value: 0 });
      }
      if (at !== 0) out.push({ type: 'SetZoneSetting', zoneId: at, key: 'squad', value: squad.id });
      return out;
    }
    const picked = choice.marks.size > 0 ? choice.marks.list(rows) : at === undefined ? [] : [at];
    if (picked.length === 0) return [];
    const members = choice.kind === 'add' ? [...squad.members, ...picked].slice(0, SQUAD_MAX_SIZE) : squad.members.filter((m) => !picked.includes(m));
    return [{ type: 'SetSquadMembers', squadId: squad.id, members }];
  }

  /** `[S-n]`: the `text_input` dialog, then `RenameSquad`. */
  rename(ctx: PanelContext): void {
    const squad = this.selectedSquad(ctx);
    if (!squad) {
      ctx.notice?.(ctx.strings.get('ui.military.no_squad'));
      return;
    }
    ctx.prompt?.({ title: ctx.strings.get('ui.military.rename_title', { squad: squad.name }), value: squad.name, maxLength: SQUAD_NAME_MAX_CHARS }, (text) => {
      if (text !== null && text !== squad.name) ctx.submit({ type: 'RenameSquad', squadId: squad.id, name: text });
    });
  }

  memberCandidates(ctx: PanelContext): number[] {
    const squad = this.selectedSquad(ctx);
    if (!squad || !this.memberChoice) return [];
    if (this.memberChoice.kind === 'remove' || this.memberChoice.kind === 'leader') return [...squad.members];
    if (this.memberChoice.kind === 'weapon' || this.memberChoice.kind === 'armor') return this.gearOptions(ctx, this.memberChoice.kind).map((_value, index) => index);
    if (this.memberChoice.kind === 'draughts') return this.draughtOptions(ctx).map((_value, index) => index);
    if (this.memberChoice.kind === 'barracks') return [0, ...this.barracksZones(ctx)];
    const assigned = new Set(this.squads(ctx).flatMap((s) => s.members));
    return dwarvesOf(ctx).filter((id) => {
      const c = ctx.readers.entities.get(id, C.Creature);
      return c?.faction === 'fortress' && c.ageTicks >= ADULT_AGE_YEARS * TICKS_PER_YEAR && ctx.readers.entities.alive(id) && !assigned.has(id);
    });
  }

  /** Add a patrol point; false when the tile cannot be stood on (nothing is sent, the pick stays armed). */
  setPatrol(ctx: PanelContext, tile: TileIndex, host?: FortressHost): boolean {
    const squad = this.selectedSquad(ctx);
    if (!squad) return true;
    if (!this.canStand(ctx, tile)) return false;
    const cmd: Command = { type: 'SetSquadPatrol', squadId: squad.id, tiles: [...(squad.patrol ?? []), tile] };
    if (host) host.submit(cmd);
    else ctx.submit(cmd);
    return true;
  }

  setOrderTarget(ctx: PanelContext, tile: TileIndex, host?: FortressHost): boolean {
    const squad = this.selectedSquad(ctx);
    if (!squad) return false;
    const dwarves = new Set(dwarvesOf(ctx));
    const target = creaturesAt(ctx.readers, tile).find((id) => this.settingKill || dwarves.has(id));
    if (target === undefined) return false;
    const order = this.settingKill ? { kind: 'kill', targetId: target } : { kind: 'follow', dwarfId: target };
    const cmd: Command = { type: 'SquadOrder', squadId: squad.id, order };
    if (host) host.submit(cmd);
    else ctx.submit(cmd);
    return true;
  }

  key(ctx: PanelContext, press: KeyPress, host?: FortressHost): boolean {
    if (press.ctrl || press.alt || press.meta) return false;
    const k = press.key;
    const up = k === 'ArrowUp' || k === '↑';
    const down = k === 'ArrowDown' || k === '↓';
    // While the panel waits for a tile or a creature, the arrows move the map cursor.
    if ((up || down) && (this.settingStation || this.settingPatrol || this.settingKill || this.settingFollow)) return false;
    // A letter that opens a panel is an accelerator here only with `Shift` (`[S-s] set`, D-U2).
    const letter = accel(ctx, press);
    const submit = (cmd: Command | null): boolean => {
      if (cmd !== null) {
        if (host !== undefined) host.submit(cmd);
        else ctx.submit(cmd);
        return true;
      }
      return false;
    };

    if (this.memberChoice) {
      const candidates = this.memberCandidates(ctx);
      if (up || down) {
        this.memberChoice.selected = Math.max(0, Math.min(candidates.length - 1, this.memberChoice.selected + (up ? -1 : 1)));
        return true;
      }
      if (k === ' ' || k === 'Space') return this.toggleMark(ctx);
      if (k === '*') { this.markAll(ctx); return true; }
      if (k === 'Enter') {
        for (const cmd of this.commitChoice(ctx)) submit(cmd);
        return true;
      }
      // The list is modal within the panel: the squad keys under it wait.
      return k.length === 1;
    }

    if (up || down) {
      this.move(up ? -1 : 1, ctx);
      return true;
    }

    // Every key of the squad below needs one: with none, the key says so and does nothing else.
    if (letter !== '' && 'scblnypkfqmotvarwgjxd'.includes(letter) && this.selectedSquad(ctx) === undefined) {
      ctx.notice?.(militaryNoSquad(ctx));
      return true;
    }

    // Alert setting keys: 1 (calm), 2 (watchful), 3 or h (hearth)
    if (k === '1') return submit({ type: 'SetAlert', level: 'calm' });
    if (k === '2') return submit({ type: 'SetAlert', level: 'watchful' });
    if (k === '3' || letter === 'h') return submit({ type: 'SetAlert', level: 'hearth' });

    // New squad / disband
    if (k === '+') {
      // §4.1: the squad limit says so instead of doing nothing.
      if (submit(this.newSquad(ctx))) return true;
      ctx.notice?.(ctx.strings.get('ui.status.squad_limit', { max: SQUAD_MAX_COUNT }));
      return true;
    }
    if (letter === 'x') {
      const cmd = this.disbandSquad(ctx, host);
      if (cmd) submit(cmd);
      return true;
    }

    // Squad details actions
    if (letter === 's') {
      this.arm(ctx, 'station');
      return true;
    }
    if (letter === 'c') return submit(this.clearStation(ctx));
    // U-06: the leader, the barracks and the squad's name, on Shift so no panel hotkey is taken.
    if (letter === 'l' && press.shift) { this.openChoice(ctx, 'leader'); return true; }
    if (letter === 'b' && press.shift) { this.openChoice(ctx, 'barracks'); return true; }
    if (letter === 'n' && press.shift) { this.rename(ctx); return true; }
    // U-03: `[S-p]` is "add" now, so clearing the patrol moved to `[y]`.
    if (letter === 'y') {
      const squad = this.selectedSquad(ctx);
      return submit(squad ? { type: 'SetSquadPatrol', squadId: squad.id, tiles: [] } : null);
    }
    if (letter === 'p') { this.arm(ctx, 'patrol'); return true; }
    if (letter === 'k') { this.arm(ctx, 'kill'); return true; }
    if (letter === 'f') { this.arm(ctx, 'follow'); return true; }
    if (letter === 'q') {
      const squad = this.selectedSquad(ctx);
      return submit(squad ? { type: 'SquadOrder', squadId: squad.id, order: { kind: 'cancel' } } : null);
    }
    if (letter === 'm') return this.changeMode(ctx, 'next', host);
    if (letter === 'o') return this.changeMode(ctx, 'off', host);
    if (letter === 't') return this.changeMode(ctx, 'train', host);
    if (letter === 'v') return this.changeMode(ctx, 'active', host);
    if (letter === 'a') { this.openChoice(ctx, 'add'); return true; }
    if (letter === 'r') { this.openChoice(ctx, 'remove'); return true; }
    if (letter === 'w') { this.openChoice(ctx, 'weapon'); return true; }
    if (letter === 'g') { this.openChoice(ctx, 'armor'); return true; }
    if (letter === 'j') return submit(this.toggleRanged(ctx));
    if (letter === 'd' && press.shift) { this.openChoice(ctx, 'draughts'); return true; }

    return false;
  }
}

export function drawMilitaryPanel(
  s: Surface,
  rect: Rect,
  panel: MilitaryPanel,
  ctx: PanelContext,
  host?: FortressHost,
): void {
  const t = s.theme;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  let row = rect.row;

  const combat = ctx.readers.has('16') ? ctx.readers.of<CombatReader>('16') : null;
  const currentAlert: Alert = combat ? combat.alert() : 'calm';

  const alertStr = `Alert: ${currentAlert === 'hearth' ? 'Hearth' : currentAlert === 'watchful' ? 'Watchful' : 'Calm'}`;
  label(s, col, row, alertStr, { fg: currentAlert === 'hearth' ? t.danger : currentAlert === 'watchful' ? t.alert : t.good, width });
  row += 1;
  captionButtons(s, col, row, '[1] Calm  [2] Watch  [3] Hearth', [
    () => ctx.submit({ type: 'SetAlert', level: 'calm' }),
    () => ctx.submit({ type: 'SetAlert', level: 'watchful' }),
    () => ctx.submit({ type: 'SetAlert', level: 'hearth' }),
  ], { width });
  row += 1;
  // One line says what the current alert does.
  for (const line of wrapText(ctx.strings.get(`ui.military.alert_${currentAlert}`), width, 2)) {
    label(s, col, row, line, { fg: t.dim, width, keys: false });
    row += 1;
  }

  // Squads header
  label(s, col, row, 'Squads', { fg: t.key, width });
  row += 1;

  const squads = panel.squads(ctx);
  // Q13: the table's header takes a row, so the list is one row taller than its squads.
  const listHeight = Math.min(SQUAD_MAX_COUNT, squads.length) + 1;
  if (squads.length === 0) {
    label(s, col, row, 'No squads yet: [+] makes one.', { fg: t.dim, width });
    // What a first squad needs (the measured rule: iron spears and a kill order hold off boars; clubs do not).
    label(s, col, row + 1, ctx.strings.get('ui.military.no_squads_tip1'), { fg: t.dim, width, keys: false });
    label(s, col, row + 2, ctx.strings.get('ui.military.no_squads_tip2'), { fg: t.dim, width, keys: false });
  } else table(
    s,
    { col, row, cols: width, rows: listHeight },
    [
      { title: 'Squad', width: 18 },
      { title: 'Size', width: 6 },
      { title: 'Mode', width: 8 },
    ],
    squads.map((sq) => [
      sq.name,
      `${sq.members.length}/${SQUAD_MAX_SIZE}`,
      sq.mode,
    ]),
    panel.list,
    (idx) => { panel.list.selected = idx; }
  );
  row += listHeight + (squads.length === 0 ? 2 : 0);

  // [+] new squad  [x] disband
  captionButtons(s, col, row, '[+] new squad  [x] disband', [
    () => {
      const cmd = panel.newSquad(ctx);
      if (cmd) ctx.submit(cmd);
      else ctx.notice?.(ctx.strings.get('ui.status.squad_limit', { max: SQUAD_MAX_COUNT }));
    },
    () => { panel.disbandSquad(ctx, host); },
  ], { width });
  row += 1;

  const squad = panel.selectedSquad(ctx);
  if (!squad) return;

  if (panel.memberChoice) {
    drawChoice(s, rect, row, panel, ctx);
    return;
  }

  // Selected squad header: ── Name ─────────────
  separator(s, col, row, width, squad.name);
  row += 1;

  // Leader line: Leader Halvar Grimshield (Warden)
  let leaderText = 'none';
  if (squad.leaderId !== 0) {
    const leaderCreature = ctx.readers.entities.get(squad.leaderId, C.Creature);
    const leaderTitle = ctx.readers.entities.get(squad.leaderId, C.Title)?.title;
    const name = leaderCreature?.name ?? 'Leader';
    leaderText = leaderTitle ? `${name} (${leaderTitle.charAt(0).toUpperCase() + leaderTitle.slice(1)})` : name;
  }
  label(s, col, row, `Leader  ${leaderText}`, { width });
  row += 1;
  captionButtons(s, col, row, ctx.strings.get('ui.military.leader_keys'), [() => panel.openChoice(ctx, 'leader'), () => panel.rename(ctx)], { width });
  row += 1;

  label(s, col, row, `Mode: ${squad.mode}`, { width });
  row += 1;
  captionButtons(s, col, row, '[S-o] Off [S-t] Train [v] Active', [
    () => panel.changeMode(ctx, 'off', host),
    () => panel.changeMode(ctx, 'train', host),
    () => panel.changeMode(ctx, 'active', host),
  ], { width });
  row += 1;

  // Members line: Members Halvar G., Einar R.
  const memberNames = squad.members.map((mid) => {
    const c = ctx.readers.entities.get(mid, C.Creature);
    const mark = channelMark(ctx, mid);
    return c ? `${shortDwarfName(c.name)}${mark === '' ? '' : ` ${mark}`}` : '?';
  });
  const membersStr = memberNames.length > 0 ? memberNames.join(', ') : 'none';
  label(s, col, row, `Members ${membersStr}`, { width });
  row += 1;
  captionButtons(s, col, row, '        [S-a] add  [r] remove', [() => panel.openChoice(ctx, 'add'), () => panel.openChoice(ctx, 'remove')], { width });
  row += 1;

  // Separate rows keep the dropdown marks and ranged control visible in a narrow sidebar.
  const rangedGlyph = squad.equipment.ranged ? '■' : '□';
  label(s, col, row, ctx.strings.get('ui.military.weapon', { value: squad.equipment.weaponClass }), { width });
  s.hit({ col: col + 5, row, cols: width - 5, rows: 1 }, () => panel.openChoice(ctx, 'weapon'));
  row += 1;
  label(s, col, row, ctx.strings.get('ui.military.armor', { value: squad.equipment.armor }), { width });
  s.hit({ col: col + 2, row, cols: width - 2, rows: 1 }, () => panel.openChoice(ctx, 'armor'));
  row += 1;
  label(s, col, row, ctx.strings.get('ui.military.ranged', { mark: rangedGlyph }), { width });
  s.hit({ col: col + 2, row, cols: width - 2, rows: 1 }, () => {
    const cmd = panel.toggleRanged(ctx);
    if (cmd) ctx.submit(cmd);
  });
  row += 1;
  // 25 § Draughts: the squad's ordered list; each member carries one of each.
  const listed = (squad.equipment.draughts ?? []).map((d) => ctx.registry.table<{ id: string; name: string }>('items').byId(d)?.name ?? d);
  label(s, col, row, ctx.strings.get('ui.military.draughts', { list: listed.length === 0 ? ctx.strings.get('ui.military.draughts_none') : listed.join(', ') }), { width });
  s.hit({ col: col + 2, row, cols: width - 2, rows: 1 }, () => panel.openChoice(ctx, 'draughts'));
  row += 1;

  // Station line: Station (60,28,z31) [s] set [c]lear
  const map = ctx.readers.map;
  let stationStr = 'none';
  if (squad.station !== null) {
    const sx = squad.station % map.w;
    const sy = Math.floor(squad.station / map.w) % map.h;
    const sz = Math.floor(squad.station / (map.w * map.h));
    stationStr = `(${sx},${sy},z${sz})`;
  }
  const stText = panel.settingStation ? 'Click tile...' : stationStr;
  label(s, col, row, `Station ${stText}`, { fg: panel.settingStation ? t.value : t.text, width });
  row += 1;
  captionButtons(s, col, row, '        [S-s] set  [S-c] clear', [
    () => panel.arm(ctx, 'station'),
    squad.station === null ? null : () => {
      const cmd = panel.clearStation(ctx);
      if (cmd) ctx.submit(cmd);
    },
  ], { width });
  row += 1;

  // Patrol line
  const patrolStr = squad.patrol && squad.patrol.length > 0 ? `${squad.patrol.length} pts` : 'none';
  captionButtons(s, col, row, `Patrol ${panel.settingPatrol ? 'Click tile...' : `${patrolStr} [S-p] add [y] clear`}`, [
    () => panel.arm(ctx, 'patrol'),
    () => ctx.submit({ type: 'SetSquadPatrol', squadId: squad.id, tiles: [] }),
  ], { width });
  row += 1;

  captionButtons(s, col, row, panel.settingKill ? 'Orders Click creature to attack' : panel.settingFollow ? 'Orders Click dwarf to follow' : 'Orders [S-k] kill [S-f] follow', [
    () => panel.arm(ctx, 'kill'),
    () => panel.arm(ctx, 'follow'),
  ], { width });
  row += 1;
  captionButtons(s, col, row, '       [q] cancel orders', [() => {
    const cmd = panel.selectedSquad(ctx);
    if (cmd) ctx.submit({ type: 'SquadOrder', squadId: cmd.id, order: { kind: 'cancel' } });
  }], { width });
  row += 1;

  // Barracks: the zone assigned to the squad (`SetZoneSetting`), and the one it trains at when
  // that differs (16 keeps the first barracks a squad trained in).
  const strings = ctx.strings;
  const assigned = panel.assignedBarracks(ctx, squad.id);
  const used = squad.barracksZoneId;
  const barracks = assigned !== 0
    ? strings.get('ui.military.barracks_assigned', { zone: zoneName(ctx, assigned) })
    : used !== 0 ? strings.get('ui.military.barracks_used', { zone: zoneName(ctx, used) }) : strings.get('ui.military.barracks_none');
  label(s, col, row, barracks, { fg: assigned !== 0 ? t.text : t.dim, width });
  s.hit({ col, row, cols: width, rows: 1 }, () => panel.openChoice(ctx, 'barracks'));
}

/** The open list: dwarves to add, members to remove, the leader, or the barracks. */
function drawChoice(s: Surface, rect: Rect, top: number, panel: MilitaryPanel, ctx: PanelContext): void {
  const choice = panel.memberChoice;
  const squad = panel.selectedSquad(ctx);
  if (!choice || !squad) return;
  const strings = ctx.strings;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const multi = choice.kind === 'add' || choice.kind === 'remove';
  const ids = panel.memberCandidates(ctx);
  choice.marks.prune(ids);
  separator(s, col, top, width, strings.get(`ui.military.choice.${choice.kind}`, { n: choice.marks.size, free: panel.freeSlots(ctx) }));
  const first = top + 1;
  const foot = rect.row + rect.rows - 1;
  const height = Math.max(1, foot - first - (multi ? 1 : 0));
  const state = { selected: choice.selected, scroll: choice.scroll };
  clampList(state, ids.length, height);
  choice.selected = state.selected;
  choice.scroll = state.scroll;
  const b = ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null;
  for (let r = 0; r < height && state.scroll + r < ids.length; r += 1) {
    const k = state.scroll + r;
    const id = ids[k] as number;
    let text: string;
    if (choice.kind === 'draughts') {
      const draught = panel.draughtOptions(ctx)[id] ?? '';
      const list = squad.equipment.draughts ?? [];
      const at = list.indexOf(draught);
      const trigger = ctx.registry.table<{ id: string; trigger: string }>('draughts').byId(draught)?.trigger ?? '';
      text = strings.get('ui.military.draught_row', {
        mark: at < 0 ? '□' : '■',
        name: ctx.registry.table<{ id: string; name: string }>('items').byId(draught)?.name ?? draught,
        when: strings.get(`ui.military.draught_when.${trigger}`),
        order: at < 0 ? '' : ` (${at + 1})`,
      });
    } else if (choice.kind === 'weapon' || choice.kind === 'armor') {
      const value = panel.gearOptions(ctx, choice.kind)[id] ?? '';
      const current = choice.kind === 'weapon' ? squad.equipment.weaponClass : squad.equipment.armor;
      text = value === current ? strings.get('ui.military.gear_current', { value }) : value;
    } else if (choice.kind === 'barracks') {
      const holder = id === 0 ? 0 : Number(b?.zone(id)?.settings['squad'] ?? 0);
      const other = holder === 0 || holder === squad.id ? undefined : panel.squads(ctx).find((sq) => sq.id === holder)?.name;
      text = id === 0 ? strings.get('ui.military.barracks_row_none') : other === undefined ? zoneName(ctx, id) : strings.get('ui.military.barracks_row_taken', { zone: zoneName(ctx, id), squad: other });
      if (id !== 0 && id === panel.assignedBarracks(ctx, squad.id)) text = strings.get('ui.military.barracks_row_current', { zone: zoneName(ctx, id) });
    } else {
      const name = ctx.readers.entities.get(id, C.Creature)?.name ?? strings.get('ui.military.a_dwarf');
      text = choice.kind === 'leader' && id === squad.leaderId ? strings.get('ui.military.leader_row_current', { dwarf: name }) : name;
    }
    const mark = choice.marks.has(id) ? '•' : ' ';
    const cells = { col, row: first + r, cols: width, rows: 1 };
    label(s, col, cells.row, `${mark} ${text}`, { fg: choice.marks.has(id) ? s.theme.value : s.theme.text, width, keys: false });
    if (k === choice.selected) s.invert(cells);
    // A click marks a row of a multi-select list (as `Space`), and chooses one of the others.
    s.hit(cells, () => {
      choice.selected = k;
      if (multi) panel.toggleMark(ctx, k);
      else for (const cmd of panel.commitChoice(ctx, k)) ctx.submit(cmd);
    });
  }
  const commit = (): void => { for (const cmd of panel.commitChoice(ctx)) ctx.submit(cmd); };
  if (multi) {
    captionButtons(s, col, foot - 1, strings.get('ui.military.choice_keys_mark'), [() => { panel.toggleMark(ctx); }, () => panel.markAll(ctx)], { width });
  }
  captionButtons(s, col, foot, strings.get('ui.military.choice_keys'), [commit, () => { panel.memberChoice = null; }], { width });
}
