/**
 * Military panel: squads, alert selector, duty and orders (`ui-screens/panels.md` § Military).
 * Spec: 16 § Squads, § Alerts, § Kills and loot; 24 § alert selector.
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { TileIndex, Alert } from '@core/types';
import { SQUAD_MAX_COUNT, SQUAD_MAX_SIZE, TICKS_PER_YEAR } from '@core/constants';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import type { Rect } from '@render/cellbuffer';
import type { CombatReader, SquadWithId } from '@systems/combat';
import type { Surface } from '../surface';
import { label, separator, table, type ListState } from '../widgets';
import type { PanelContext } from './context';
import type { KeyPress } from '@platform/input';
import type { FortressHost } from '../screens/fortress';
import { creaturesAt } from './look';
import { dwarvesOf } from './units';

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

export class MilitaryPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  settingStation = false;
  settingPatrol = false;
  settingKill = false;
  settingFollow = false;
  memberChoice: { kind: 'add' | 'remove'; selected: number } | null = null;

  cancel(): void {
    this.settingStation = false;
    this.settingPatrol = false;
    this.settingKill = false;
    this.settingFollow = false;
    this.memberChoice = null;
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
    return null;
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

  cycleWeapon(ctx: PanelContext): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    const weapons = ['any', 'axe', 'sword', 'hammer', 'spear', 'crossbow'];
    const cur = weapons.indexOf(squad.equipment.weaponClass);
    const next = weapons[(cur + 1) % weapons.length] as string;
    return { type: 'SetSquadEquipment', squadId: squad.id, equipment: { ...squad.equipment, weaponClass: next } };
  }

  cycleArmor(ctx: PanelContext): Command | null {
    const squad = this.selectedSquad(ctx);
    if (!squad) return null;
    const armors: ('any' | 'metal' | 'leather')[] = ['any', 'metal', 'leather'];
    const cur = armors.indexOf(squad.equipment.armor);
    const next = armors[(cur + 1) % armors.length] as 'any' | 'metal' | 'leather';
    return { type: 'SetSquadEquipment', squadId: squad.id, equipment: { ...squad.equipment, armor: next } };
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

  setStation(ctx: PanelContext, tile: TileIndex, host?: FortressHost): void {
    const squad = this.selectedSquad(ctx);
    if (!squad) return;
    if (host !== undefined) host.submit({ type: 'SetSquadStation', squadId: squad.id, tile });
    else ctx.submit({ type: 'SetSquadStation', squadId: squad.id, tile });
  }

  memberCandidates(ctx: PanelContext): number[] {
    const squad = this.selectedSquad(ctx);
    if (!squad || !this.memberChoice) return [];
    if (this.memberChoice.kind === 'remove') return [...squad.members];
    const assigned = new Set(this.squads(ctx).flatMap((s) => s.members));
    return dwarvesOf(ctx).filter((id) => {
      const c = ctx.readers.entities.get(id, C.Creature);
      return c?.faction === 'fortress' && c.ageTicks >= ADULT_AGE_YEARS * TICKS_PER_YEAR && ctx.readers.entities.alive(id) && !assigned.has(id);
    });
  }

  chooseMember(ctx: PanelContext, index: number): Command | null {
    const squad = this.selectedSquad(ctx);
    const choice = this.memberChoice;
    const id = this.memberCandidates(ctx)[index];
    if (!squad || !choice || id === undefined) return null;
    this.memberChoice = null;
    const members = choice.kind === 'add' ? [...squad.members, id] : squad.members.filter((m) => m !== id);
    return { type: 'SetSquadMembers', squadId: squad.id, members };
  }

  setPatrol(ctx: PanelContext, tile: TileIndex, host?: FortressHost): void {
    const squad = this.selectedSquad(ctx);
    if (!squad) return;
    const cmd: Command = { type: 'SetSquadPatrol', squadId: squad.id, tiles: [...(squad.patrol ?? []), tile] };
    if (host) host.submit(cmd);
    else ctx.submit(cmd);
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
    const letter = k.length === 1 ? k.toLowerCase() : '';
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
      if (k === 'Enter') return submit(this.chooseMember(ctx, this.memberChoice.selected));
      return false;
    }

    if (up || down) {
      this.move(up ? -1 : 1, ctx);
      return true;
    }

    // Alert setting keys: 1 (calm), 2 (watchful), 3 or h (hearth)
    if (k === '1') return submit({ type: 'SetAlert', level: 'calm' });
    if (k === '2') return submit({ type: 'SetAlert', level: 'watchful' });
    if (k === '3' || letter === 'h') return submit({ type: 'SetAlert', level: 'hearth' });

    // New squad / disband
    if (k === '+') return submit(this.newSquad(ctx));
    if (letter === 'x') {
      const cmd = this.disbandSquad(ctx, host);
      if (cmd) submit(cmd);
      return true;
    }

    // Squad details actions
    if (letter === 's') {
      this.settingStation = true;
      return true;
    }
    if (letter === 'c') return submit(this.clearStation(ctx));
    if (letter === 'p' && press.shift) {
      const squad = this.selectedSquad(ctx);
      return submit(squad ? { type: 'SetSquadPatrol', squadId: squad.id, tiles: [] } : null);
    }
    if (letter === 'p') { this.settingPatrol = true; return true; }
    if (letter === 'k') { this.settingKill = true; return true; }
    if (letter === 'f') { this.settingFollow = true; return true; }
    if (letter === 'q') {
      const squad = this.selectedSquad(ctx);
      return submit(squad ? { type: 'SquadOrder', squadId: squad.id, order: { kind: 'cancel' } } : null);
    }
    if (letter === 'm') return submit(this.cycleMode(ctx));
    if (letter === 'o') return submit(this.setMode(ctx, 'off'));
    if (letter === 't') return submit(this.setMode(ctx, 'train'));
    if (letter === 'v') return submit(this.setMode(ctx, 'active'));
    if (letter === 'a') { this.memberChoice = { kind: 'add', selected: 0 }; return true; }
    if (letter === 'r') { this.memberChoice = { kind: 'remove', selected: 0 }; return true; }
    if (letter === 'w') return submit(this.cycleWeapon(ctx));
    if (letter === 'g') return submit(this.cycleArmor(ctx));
    if (letter === 'j') return submit(this.toggleRanged(ctx));

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
  label(s, col, row, '[1] Calm  [2] Watch  [3] Hearth', { width });

  // Hit tests for alert line:
  s.hit({ col, row, cols: 8, rows: 1 }, () => ctx.submit({ type: 'SetAlert', level: 'calm' }));
  s.hit({ col: col + 10, row, cols: 9, rows: 1 }, () => ctx.submit({ type: 'SetAlert', level: 'watchful' }));
  s.hit({ col: col + 21, row, cols: 10, rows: 1 }, () => ctx.submit({ type: 'SetAlert', level: 'hearth' }));
  row += 1;

  // Squads header
  label(s, col, row, 'Squads', { fg: t.key, width });
  row += 1;

  const squads = panel.squads(ctx);
  const listHeight = Math.min(3, Math.max(1, squads.length));
  table(
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
  row += listHeight;

  // [+] new squad  [x] disband
  label(s, col, row, '[+] new squad  [x] disband', { width });
  s.hit({ col, row, cols: 13, rows: 1 }, () => {
    const cmd = panel.newSquad(ctx);
    if (cmd) ctx.submit(cmd);
  });
  s.hit({ col: col + 15, row, cols: 12, rows: 1 }, () => {
    panel.disbandSquad(ctx, host);
  });
  row += 1;

  const squad = panel.selectedSquad(ctx);
  if (!squad) return;

  if (panel.memberChoice) {
    separator(s, col, row, width, panel.memberChoice.kind === 'add' ? 'Add squad member' : 'Remove squad member');
    row += 1;
    const ids = panel.memberCandidates(ctx);
    const start = Math.max(0, panel.memberChoice.selected - Math.max(0, rect.rows - row + rect.row - 3));
    for (let k = start; k < ids.length && row < rect.row + rect.rows - 1; k += 1) {
      const id = ids[k] as number;
      label(s, col, row, `${k === panel.memberChoice.selected ? '▶' : ' '} ${ctx.readers.entities.get(id, C.Creature)?.name ?? `#${id}`}`, { width });
      s.hit({ col, row, cols: width, rows: 1 }, () => {
        const cmd = panel.chooseMember(ctx, k);
        if (cmd) ctx.submit(cmd);
      });
      row += 1;
    }
    label(s, col, rect.row + rect.rows - 1, '[Enter] select  [Esc] cancel', { width });
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

  label(s, col, row, `Mode: ${squad.mode}`, { width });
  row += 1;
  label(s, col, row, '[o] Off  [t] Train  [v] Active', { width });
  s.hit({ col, row, cols: 7, rows: 1 }, () => ctx.submit({ type: 'SetSquadMode', squadId: squad.id, mode: 'off' }));
  s.hit({ col: col + 9, row, cols: 9, rows: 1 }, () => ctx.submit({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' }));
  s.hit({ col: col + 20, row, cols: 10, rows: 1 }, () => ctx.submit({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' }));
  row += 1;

  // Members line: Members Halvar G., Einar R.
  const memberNames = squad.members.map((mid) => {
    const c = ctx.readers.entities.get(mid, C.Creature);
    return c ? shortDwarfName(c.name) : `#${mid}`;
  });
  const membersStr = memberNames.length > 0 ? memberNames.join(', ') : 'none';
  label(s, col, row, `Members ${membersStr}`, { width });
  row += 1;
  label(s, col, row, '        [a] add  [r] remove', { width });
  s.hit({ col: col + 8, row, cols: 7, rows: 1 }, () => {
    panel.memberChoice = { kind: 'add', selected: 0 };
  });
  s.hit({ col: col + 17, row, cols: 10, rows: 1 }, () => {
    panel.memberChoice = { kind: 'remove', selected: 0 };
  });
  row += 1;

  // Gear preferences have separate rows so every control fits a narrow sidebar.
  const rangedGlyph = squad.equipment.ranged ? '■' : '□';
  label(s, col, row, `Gear [w] weapon ${squad.equipment.weaponClass}`, { width });
  s.hit({ col: col + 5, row, cols: width - 5, rows: 1 }, () => {
    const cmd = panel.cycleWeapon(ctx);
    if (cmd) ctx.submit(cmd);
  });
  row += 1;
  label(s, col, row, `     [g] armor ${squad.equipment.armor}  [j] ranged ${rangedGlyph}`, { width });
  s.hit({ col: col + 5, row, cols: 15, rows: 1 }, () => {
    const cmd = panel.cycleArmor(ctx);
    if (cmd) ctx.submit(cmd);
  });
  s.hit({ col: col + 21, row, cols: 13, rows: 1 }, () => {
    const cmd = panel.toggleRanged(ctx);
    if (cmd) ctx.submit(cmd);
  });
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
  label(s, col, row, '        [s] set  [c] clear', { width });
  s.hit({ col: col + 8, row, cols: 7, rows: 1 }, () => {
    panel.settingStation = true;
  });
  if (squad.station !== null) {
    s.hit({ col: col + 17, row, cols: 10, rows: 1 }, () => {
      const cmd = panel.clearStation(ctx);
      if (cmd) ctx.submit(cmd);
    });
  }
  row += 1;

  // Patrol line
  const patrolStr = squad.patrol && squad.patrol.length > 0 ? `${squad.patrol.length} tiles` : 'none';
  label(s, col, row, `Patrol ${panel.settingPatrol ? 'Click tile...' : `${patrolStr} [p] add [P] clear`}`, { width });
  s.hit({ col: col + 8 + patrolStr.length, row, cols: 7, rows: 1 }, () => { panel.settingPatrol = true; });
  s.hit({ col: col + 16 + patrolStr.length, row, cols: 9, rows: 1 }, () => ctx.submit({ type: 'SetSquadPatrol', squadId: squad.id, tiles: [] }));
  row += 1;

  label(s, col, row, panel.settingKill ? 'Orders Click creature to attack' : panel.settingFollow ? 'Orders Click dwarf to follow' : 'Orders [k] kill [f] follow', { width });
  s.hit({ col: col + 8, row, cols: 8, rows: 1 }, () => { panel.settingKill = true; });
  s.hit({ col: col + 17, row, cols: 10, rows: 1 }, () => { panel.settingFollow = true; });
  row += 1;
  label(s, col, row, '       [q] cancel orders', { width });
  s.hit({ col: col + 7, row, cols: 19, rows: 1 }, () => {
    const cmd = panel.selectedSquad(ctx);
    if (cmd) ctx.submit({ type: 'SquadOrder', squadId: cmd.id, order: { kind: 'cancel' } });
  });
  row += 1;

  // Barracks line
  if (squad.barracksZoneId > 0) {
    label(s, col, row, `Barracks #${squad.barracksZoneId} · training active`, { fg: t.dim, width });
  } else {
    label(s, col, row, 'Barracks none · assign zone', { fg: t.dim, width });
  }
}
