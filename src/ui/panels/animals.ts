/** `ui-screens/panels.md` § Animals; `08` § Player-facing behavior. */
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { KeyPress } from '@platform/input';
import { BREEDING_CAP_MIN, BREEDING_CAP_MAX, BREEDING_CAP_BIG_STEP } from '../constants';
import { trainKey, type AnimalsReader } from '@systems/animals';
import type { BuildingsReader } from '@systems/buildings';
import type { ForagingReader } from '@systems/foraging';
import type { JobsReader } from '@systems/jobs';
import type { Surface } from '../surface';
import { button, label, normalizeName, numberField, separator, table, textField, type ListState, type TextFieldState } from '../widgets';
import { buildings, confirmThen, type PanelContext } from './context';
import { dwarvesOf } from './units';
import { acceleratorLabel } from '../keymap';
import { rejectionText } from '../messages';

export class AnimalsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  tab: 0 | 1 = 0;
  readonly name: TextFieldState = { value: '', focused: false, maxLength: 24 };
  trainChoice: { animalId: EntityId; selected: 0 | 1 } | null = null;
  capEditor: { species: number; value: number; replace: boolean } | null = null;
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
  startCap(ctx: PanelContext): void {
    const r = this.reader(ctx);
    const species = ctx.readers.entities.get(this.selected(ctx), C.Creature)?.species;
    if (r === null || species === undefined) {
      ctx.notice?.(rejectionText(ctx, { type: 'SetBreedingCap', species: 0, cap: 0 }, 'unknown_species'));
      return;
    }
    this.name.focused = false; this.trainChoice = null;
    this.capEditor = { species, value: r.breedingCap(species), replace: true };
  }
  adjustCap(delta: number): void {
    if (this.capEditor === null) return;
    this.capEditor.value = Math.max(BREEDING_CAP_MIN, Math.min(BREEDING_CAP_MAX, this.capEditor.value + delta));
    this.capEditor.replace = true;
  }
  finishCap(): Command | null {
    const editor = this.capEditor; this.capEditor = null;
    return editor === null ? null : { type: 'SetBreedingCap', species: editor.species, cap: editor.value };
  }
  capKey(ctx: PanelContext, press: KeyPress): boolean {
    const editor = this.capEditor;
    if (editor === null || press.ctrl || press.alt || press.meta) return false;
    if (press.key === 'Esc' || press.key === 'Escape') { this.capEditor = null; return true; }
    if (press.key === 'Enter') { const cmd = this.finishCap(); if (cmd) ctx.submit(cmd); return true; }
    if (['+', '=', '-', '_'].includes(press.key)) {
      this.adjustCap((press.key === '-' || press.key === '_' ? -1 : 1) * (press.shift || press.key === '_' ? BREEDING_CAP_BIG_STEP : 1));
      return true;
    }
    if (/^[0-9]$/.test(press.key)) {
      editor.value = Math.min(BREEDING_CAP_MAX, Number(`${editor.replace ? '' : editor.value}${press.key}`));
      editor.replace = false; return true;
    }
    if (press.key === 'Backspace') { editor.value = Math.floor(editor.value / 10); editor.replace = false; return true; }
    return false;
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
    this.capEditor = null;
    this.trainChoice = null;
    this.name.value = ctx.readers.entities.get(this.selected(ctx), C.Creature)?.name ?? '';
    this.name.focused = true;
  }
  finishName(ctx: PanelContext): Command | null {
    this.name.focused = false;
    const id = this.selected(ctx);
    const value = normalizeName(this.name.value);
    return id === 0 || value.length === 0 ? null : { type: 'NameAnimal', animalId: id, name: value };
  }
  startTrain(ctx: PanelContext): void {
    this.capEditor = null;
    const id = this.selected(ctx);
    const refuse = (reason: string): void => ctx.notice?.(rejectionText(ctx, { type: 'TrainAnimal', animalId: id, kind: 'war' }, reason));
    const creature = ctx.readers.entities.get(id, C.Creature);
    if (id === 0 || creature === undefined) { refuse('not_tame'); return; }
    const def = this.reader(ctx)?.def(creature.species);
    const trainable = def?.trainable ?? def?.flags['trainable'];
    if (typeof trainable !== 'string' || trainable === 'none') {
      refuse('not_trainable');
      return;
    }
    this.name.focused = false;
    this.trainChoice = { animalId: id, selected: 0 };
  }
  finishTrain(): Command | null {
    if (this.trainChoice === null) return null;
    const { animalId, selected } = this.trainChoice;
    this.trainChoice = null;
    const kind: 'war' | 'hunting' = selected === 0 ? 'war' : 'hunting';
    return { type: 'TrainAnimal', animalId, kind };
  }
}

function trainStatus(ctx: PanelContext, id: EntityId, trained: string): string {
  if (ctx.readers.has('11')) {
    const job = ctx.readers.of<JobsReader>('11').byKey(trainKey(id));
    if (job !== undefined && job.state !== 'done' && job.state !== 'cancelled') return ctx.strings.get('ui.animals.training');
  }
  if (trained === 'war') return ctx.strings.get('ui.animals.trained_war');
  if (trained === 'hunting') return ctx.strings.get('ui.animals.trained_hunting');
  return '';
}

export function drawAnimalsPanel(s: Surface, rect: Rect, panel: AnimalsPanel, ctx: PanelContext): void {
  const r = panel.reader(ctx); if (r === null) return;
  const col = rect.col + 1; const width = rect.cols - 2;
  label(s, col, rect.row, `[1] Tame (${r.tameList().length})  [2] Wild (${r.wildList().length})`, { fg: s.theme.key, width });
  const ids = panel.rows(ctx);
  const height = Math.max(2, rect.rows - (panel.tab === 0 ? 8 : 7));
  table(s, { col, row: rect.row + 1, cols: width, rows: height },
    panel.tab === 0
      ? [{ title: 'Species', width: 8 }, { title: 'Name', width: 7 }, { title: 'Pasture', width: 6 }, { title: 'Cond/Tr', width: 12 }]
      : [{ title: 'Species', width: 10 }, { title: 'Name', width: 9 }, { title: 'Pasture', width: 8 }, { title: 'Cond/Tr', width: 9 }],
    ids.map((id) => {
      const creature = ctx.readers.entities.get(id, C.Creature);
      const tame = ctx.readers.entities.get(id, C.Tame);
      const species = r.def(creature?.species ?? 0)?.name ?? '?';
      if (tame === undefined) {
        const count = r.bySpecies(creature?.species ?? 0, true).length;
        const hunt = ctx.readers.has('09') && ctx.readers.of<ForagingReader>('09').isHuntable(creature?.species ?? 0);
        return [`${species} ×${count}`, hunt ? 'hunt' : '—', '—', r.state(id)];
      }
      const tr = trainStatus(ctx, id, tame.trained);
      const cond = Math.round(r.condition(id));
      const preg = tame.pregnantUntil > ctx.readers.calendar.tick ? ' P' : '';
      const slaught = tame.slaughter ? ' S' : '';
      const condTr = tr ? `${cond} ${tr}${preg}${slaught}` : `${cond}${preg}${slaught}`;
      return [species, creature?.name === species ? '—' : creature?.name ?? '—', r.pastureOf(id) === 0 ? '—' : `#${(buildings(ctx)?.zonesOfType('pasture') ?? []).indexOf(r.pastureOf(id)) + 1}`, condTr];
    }), panel.list, (i) => { panel.list.selected = i; });
  let row = rect.row + height + 1;
  separator(s, col, row, width); row += 1;
  if (panel.tab === 0) {
    if (panel.capEditor !== null) {
      label(s, col, row, ctx.strings.get('ui.animals.cap'), { width }); row += 1;
      numberField(s, col, row, panel.capEditor.value, delta => panel.adjustCap(delta), { min: BREEDING_CAP_MIN, max: BREEDING_CAP_MAX, width: 3 }); row += 1;
      const n = button(s, col, row, 'Enter', ctx.strings.get('ui.animals.cap_set'), () => { const cmd = panel.finishCap(); if (cmd) ctx.submit(cmd); });
      button(s, col + n + 1, row, 'Esc', ctx.strings.get('ui.text_input.cancel'), () => { panel.capEditor = null; }); row += 1;
      label(s, col, row, ctx.strings.get('ui.animals.cap_keys'), { width });
    } else if (panel.trainChoice !== null) {
      label(s, col, row, ctx.strings.get('ui.animals.train_prompt'), { fg: s.theme.key, width }); row += 1;
      const labels = [ctx.strings.get('ui.animals.war'), ctx.strings.get('ui.animals.hunting')] as const;
      for (let i = 0; i < labels.length; i += 1) {
        const selected = panel.trainChoice.selected === i;
        const cells = { col, row, cols: width, rows: 1 };
        label(s, col, row, `${selected ? '▶ ' : '  '}${labels[i]}`, { fg: selected ? s.theme.value : s.theme.text, width });
        if (selected) s.invert(cells);
        const idx = i as 0 | 1;
        s.hit(cells, () => {
          if (panel.trainChoice !== null) panel.trainChoice.selected = idx;
          const cmd = panel.finishTrain();
          if (cmd) ctx.submit(cmd);
        });
        row += 1;
      }
      const n = button(s, col, row, 'Enter', ctx.strings.get('ui.animals.train'), () => { const cmd = panel.finishTrain(); if (cmd) ctx.submit(cmd); });
      button(s, col + n + 1, row, 'Esc', ctx.strings.get('ui.text_input.cancel'), () => { panel.trainChoice = null; });
    } else {
      // Every letter here opens a panel, so each action takes `Shift` (D-U2).
      label(s, col, row, ctx.strings.get('ui.animals.actions1'), { width }); row += 1;
      label(s, col, row, ctx.strings.get('ui.animals.actions2'), { width });
      s.hit({ col, row, cols: 9, rows: 1 }, () => panel.startCap(ctx)); row += 1;
      button(s, col, row, acceleratorLabel('t', ctx.panelLetters).slice(1, -1), ctx.strings.get('ui.animals.train'), () => panel.startTrain(ctx)); row += 1;
      const species = ctx.readers.entities.get(panel.selected(ctx), C.Creature)?.species;
      if (species !== undefined) label(s, col, row, panel.name.focused ? 'Name:' : `Breeding cap: ${r.breedingCap(species)}`, { width });
      if (panel.name.focused) textField(s, col + 6, row, Math.max(1, width - 10), panel.name);
    }
  } else {
    label(s, col, row, '[h] hunt toggle', { width });
  }
}
