/** `ui-screens/panels.md` § Animals; `08` § Player-facing behavior. */
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { AnimalsReader } from '@systems/animals';
import type { BuildingsReader } from '@systems/buildings';
import type { ForagingReader } from '@systems/foraging';
import type { Surface } from '../surface';
import { label, separator, table, textField, type ListState, type TextFieldState } from '../widgets';
import { buildings, confirmThen, type PanelContext } from './context';
import { dwarvesOf } from './units';

export class AnimalsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  tab: 0 | 1 = 0;
  readonly name: TextFieldState = { value: '', focused: false, maxLength: 24 };
  reader(ctx: PanelContext): AnimalsReader | null { return ctx.readers.has('08') ? ctx.readers.of<AnimalsReader>('08') : null; }
  rows(ctx: PanelContext): EntityId[] {
    const r = this.reader(ctx);
    if (r === null) return [];
    if (this.tab === 0) return r.tameList();
    const seen = new Set<number>();
    return r.wildList().filter((id) => {
      const species = ctx.readers.entities.get(id, C.Creature)?.species ?? 0;
      if (seen.has(species)) return false;
      seen.add(species);
      return true;
    });
  }
  selected(ctx: PanelContext): EntityId { return this.rows(ctx)[this.list.selected] ?? 0; }
  move(delta: number, ctx: PanelContext): void { this.list.selected = Math.max(0, Math.min(Math.max(0, this.rows(ctx).length - 1), this.list.selected + delta)); }
  pasture(ctx: PanelContext): Command | null {
    const id = this.selected(ctx); const r = this.reader(ctx); const b = ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null;
    if (id === 0 || r === null || b === null) return null;
    const options = [0, ...b.zonesOfType('pasture')];
    const at = options.indexOf(r.pastureOf(id));
    return { type: 'AssignPasture', animalId: id, zoneId: options[(at + 1) % options.length] ?? 0 };
  }
  slaughter(ctx: PanelContext): Command | null {
    const id = this.selected(ctx); if (id === 0) return null;
    return { type: ctx.readers.entities.get(id, C.Tame)?.slaughter ? 'UnmarkSlaughter' : 'MarkSlaughter', animalId: id };
  }
  /** `[S-s]`: mark for slaughter after asking (D-U2); taking the mark off needs no question. */
  slaughterAsk(ctx: PanelContext): void {
    const cmd = this.slaughter(ctx);
    if (cmd === null) return;
    if (cmd.type !== 'MarkSlaughter') { ctx.submit(cmd); return; }
    const id = this.selected(ctx);
    const creature = ctx.readers.entities.get(id, C.Creature);
    const species = this.reader(ctx)?.def(creature?.species ?? 0)?.name ?? '';
    const animal = creature === undefined || creature.name === species || creature.name === '' ? `the ${species}` : `${creature.name} the ${species}`;
    confirmThen(ctx, 'c_slaughter_animal', { animal }, () => ctx.submit(cmd));
  }
  cap(ctx: PanelContext): Command | null {
    const id = this.selected(ctx); const r = this.reader(ctx); const species = ctx.readers.entities.get(id, C.Creature)?.species;
    if (r === null || species === undefined) return null;
    return { type: 'SetBreedingCap', species, cap: (r.breedingCap(species) + 1) % 101 };
  }
  assign(ctx: PanelContext): Command | null {
    const id = this.selected(ctx);
    const tame = ctx.readers.entities.get(id, C.Tame);
    if (tame === undefined) return null;
    const candidates = [0, ...dwarvesOf(ctx)];
    const at = candidates.indexOf(tame.assignedTo);
    return { type: 'AssignAnimal', animalId: id, dwarfId: candidates[(at + 1) % candidates.length] ?? 0 };
  }
  hunt(ctx: PanelContext): Command | null {
    const id = this.selected(ctx);
    const species = ctx.readers.entities.get(id, C.Creature)?.species;
    if (species === undefined || !ctx.readers.has('09')) return null;
    const r = ctx.readers.of<ForagingReader>('09');
    return { type: 'SetHuntable', species, on: !r.isHuntable(species) };
  }
  startName(ctx: PanelContext): void {
    this.name.value = ctx.readers.entities.get(this.selected(ctx), C.Creature)?.name ?? '';
    this.name.focused = true;
  }
  finishName(ctx: PanelContext): Command | null {
    this.name.focused = false;
    const id = this.selected(ctx);
    const value = this.name.value.trim();
    return id === 0 || value.length === 0 ? null : { type: 'NameAnimal', animalId: id, name: value };
  }
}

export function drawAnimalsPanel(s: Surface, rect: Rect, panel: AnimalsPanel, ctx: PanelContext): void {
  const r = panel.reader(ctx); if (r === null) return;
  const col = rect.col + 1; const width = rect.cols - 2;
  label(s, col, rect.row, `[1] Tame (${r.tameList().length})  [2] Wild (${r.wildList().length})`, { fg: s.theme.key, width });
  const ids = panel.rows(ctx);
  const height = Math.max(2, rect.rows - 7);
  table(s, { col, row: rect.row + 1, cols: width, rows: height },
    [{ title: 'Species', width: 10 }, { title: 'Name', width: 9 }, { title: 'Pasture', width: 8 }, { title: 'Cond/Tr', width: 9 }],
    ids.map((id) => {
      const creature = ctx.readers.entities.get(id, C.Creature);
      const tame = ctx.readers.entities.get(id, C.Tame);
      const species = r.def(creature?.species ?? 0)?.name ?? '?';
      if (tame === undefined) {
        const count = r.bySpecies(creature?.species ?? 0, true).length;
        const hunt = ctx.readers.has('09') && ctx.readers.of<ForagingReader>('09').isHuntable(creature?.species ?? 0);
        return [`${species} ×${count}`, hunt ? 'hunt' : '—', '—', r.state(id)];
      }
      return [species, creature?.name === species ? '—' : creature?.name ?? '—', r.pastureOf(id) === 0 ? '—' : `#${(buildings(ctx)?.zonesOfType('pasture') ?? []).indexOf(r.pastureOf(id)) + 1}`, `${Math.round(r.condition(id))} ${tame.trained}${tame.pregnantUntil > ctx.readers.calendar.tick ? ' P' : ''}${tame.slaughter ? ' S' : ''}`];
    }), panel.list, (i) => { panel.list.selected = i; });
  let row = rect.row + height + 1;
  separator(s, col, row, width); row += 1;
  if (panel.tab === 0) {
    // Every letter here opens a panel, so each action takes `Shift` (D-U2).
    label(s, col, row, ctx.strings.get('ui.animals.actions1'), { width }); row += 1;
    label(s, col, row, ctx.strings.get('ui.animals.actions2'), { width }); row += 1;
    const species = ctx.readers.entities.get(panel.selected(ctx), C.Creature)?.species;
    if (species !== undefined) label(s, col, row, panel.name.focused ? 'Name:' : `Breeding cap: ${r.breedingCap(species)}`, { width });
    if (panel.name.focused) textField(s, col + 6, row, Math.max(1, width - 10), panel.name);
  } else {
    label(s, col, row, '[h] hunt toggle', { width });
  }
}
