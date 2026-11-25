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
import { asWritten, button, captionButtons, label, normalizeName, numberField, separator, table, textField, type ListState, type TextFieldState } from '../widgets';
import { buildings, confirmThen, type PanelContext } from './context';
import { dwarvesOf } from './units';
import { acceleratorLabel } from '../keymap';
import { rejectionText, speciesPlural, wrapText, zoneName } from '../messages';
import { overGrazed, pastureFeed } from '../pasture';
import { hasOwnName } from '../creature-name';

/**
 * How fed a tame grazer is, from its condition (08: hunger, 0 fed to 100 starving): 3 (fed) to 0
 * (starving); null for an animal that does not graze, whose condition does not change.
 */
export function fedLevel(r: AnimalsReader, id: EntityId, species: number): number | null {
  if (r.def(species)?.diet !== 'grazer') return null;
  const condition = r.condition(id);
  return condition >= 100 ? 0 : condition >= 67 ? 1 : condition >= 34 ? 2 : 3;
}

/** The Fed column's bar: one `▓` a level, `░` for the rest; `—` for an animal that does not graze. */
export function fedBar(level: number | null): string {
  return level === null ? '—' : `${'▓'.repeat(level)}${'░'.repeat(3 - level)}`;
}

/**
 * How hurt a tame animal is, as the Animals panel marks it (17's `Body`): 2 while a wound bleeds
 * unbandaged, 1 while it has any other wound, 0 unhurt.
 */
export function hurtLevel(readers: PanelContext['readers'], id: EntityId): 0 | 1 | 2 {
  const wounds = readers.entities.get(id, C.Body)?.parts.flatMap((p) => p.wounds) ?? [];
  if (wounds.some((w) => w.bleed > 0 && !w.bandaged)) return 2;
  return wounds.length > 0 ? 1 : 0;
}

/** Whether a creature carries a name of its own (not its species' name or id). */
function named(name: string, species: { readonly id: string; readonly name: string } | undefined): boolean {
  return name !== '' && name !== species?.name && name !== species?.id;
}

export class AnimalsPanel {
  readonly list: ListState = { selected: 0, scroll: 0 };
  tab: 0 | 1 = 0;
  readonly name: TextFieldState = { value: '', focused: false, maxLength: 24 };
  trainChoice: { animalId: EntityId; selected: 0 | 1 } | null = null;
  capEditor: { species: number; value: number; replace: boolean } | null = null;
  reader(ctx: PanelContext): AnimalsReader | null { return ctx.readers.has('08') ? ctx.readers.of<AnimalsReader>('08') : null; }

  /**
   * The list's rows, each the animals it stands for (`panels.md` § Animals). Tame: unnamed animals
   * of one species, pasture, hunger, training, owner, slaughter mark and wounds are one row ("cow ×6"); a
   * named animal is a row of its own; by species, then the groups before the named, then pasture,
   * the best fed first. Wild: one row per species, in the order they were first seen.
   */
  groups(ctx: PanelContext): EntityId[][] {
    const r = this.reader(ctx);
    if (r === null) return [];
    if (this.tab === 1) {
      const seen = new Set<number>();
      return r.wildList().filter((id) => {
        const species = ctx.readers.entities.get(id, C.Creature)?.species ?? 0;
        if (seen.has(species)) return false;
        seen.add(species);
        return true;
      }).map((id) => [id]);
    }
    const pastures = buildings(ctx)?.zonesOfType('pasture') ?? [];
    const byKey = new Map<string, { ids: EntityId[]; sort: readonly (string | number)[] }>();
    for (const id of r.tameList()) {
      const creature = ctx.readers.entities.get(id, C.Creature);
      const tame = ctx.readers.entities.get(id, C.Tame);
      const species = creature?.species ?? 0;
      const def = r.def(species);
      const speciesName = def?.name ?? '?';
      const pasture = pastures.indexOf(r.pastureOf(id)) + 1;
      const fed = fedLevel(r, id, species) ?? 4;
      const own = named(creature?.name ?? '', def);
      const status = trainStatus(ctx, id, tame?.trained ?? 'none');
      const key = own ? `id:${id}` : [species, pasture, fed, status, tame?.assignedTo ?? 0, tame?.slaughter === true ? 1 : 0, hurtLevel(ctx.readers, id)].join(':');
      const row = byKey.get(key);
      if (row !== undefined) row.ids.push(id);
      else byKey.set(key, { ids: [id], sort: [speciesName, own ? 1 : 0, own ? creature?.name ?? '' : '', pasture === 0 ? Infinity : pasture, -fed, id] });
    }
    const compare = (a: readonly (string | number)[], b: readonly (string | number)[]): number => {
      for (let k = 0; k < a.length; k += 1) {
        const x = a[k] as string | number; const y = b[k] as string | number;
        if (x !== y) return x < y ? -1 : 1;
      }
      return 0;
    };
    return Array.from(byKey.values()).sort((a, b) => compare(a.sort, b.sort)).map((row) => row.ids);
  }
  /** Each row's first animal: the one the row's actions name. */
  rows(ctx: PanelContext): EntityId[] { return this.groups(ctx).map((ids) => ids[0] as EntityId); }
  selectedGroup(ctx: PanelContext): EntityId[] { return this.groups(ctx)[this.list.selected] ?? []; }
  selected(ctx: PanelContext): EntityId { return this.rows(ctx)[this.list.selected] ?? 0; }
  move(delta: number, ctx: PanelContext): void { this.list.selected = Math.max(0, Math.min(Math.max(0, this.rows(ctx).length - 1), this.list.selected + delta)); }
  /**
   * `[p]`: the row's animals to the next pasture, every animal of a group together. The status row
   * says what it did, and in the alert colour when the pasture's grass feeds fewer grazers than it
   * will hold ("2 cows to Pasture #1: it feeds 0 of 6 grazers.").
   */
  pasture(ctx: PanelContext): Command[] | null {
    const ids = this.selectedGroup(ctx); const r = this.reader(ctx); const b = ctx.readers.has('14') ? ctx.readers.of<BuildingsReader>('14') : null;
    const id = ids[0];
    if (id === undefined || r === null || b === null) return null;
    const options = [0, ...b.zonesOfType('pasture')];
    const at = options.indexOf(r.pastureOf(id));
    return assignPasture(ctx, ids, options[(at + 1) % options.length] ?? 0);
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
    const animal = !hasOwnName(ctx.registry, creature) || creature === undefined
      ? ctx.strings.get('ui.animals.the_species', { species })
      : ctx.strings.get('ui.animals.detail.named', { name: creature.name, species });
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

/**
 * `AssignPasture` for `ids`, every animal of a group together, with the status row's line for it: "2
 * cows to Pasture #1.", "2 cows off the pasture.", and in the alert colour when the pasture's grass
 * feeds fewer grazers than it will hold ("2 cows to Pasture #1: it feeds 0 of 6 grazers."). The
 * Animals panel's `[p]` and the pasture picker of a tame grazer's view in Look both say it so.
 */
export function assignPasture(ctx: PanelContext, ids: readonly EntityId[], zoneId: EntityId): Command[] {
  const r = ctx.readers.has('08') ? ctx.readers.of<AnimalsReader>('08') : null;
  if (r === null || ids.length === 0) return [];
  const animals = groupWords(ctx, r, ids);
  const feed = zoneId === 0 ? null : pastureFeed(ctx.readers, zoneId, ids);
  if (zoneId === 0) ctx.notice?.(ctx.strings.get('ui.animals.unpastured', { animals }));
  else if (feed !== null && overGrazed(feed) && ids.some((a) => r.def(ctx.readers.entities.get(a, C.Creature)?.species ?? 0)?.diet === 'grazer')) {
    ctx.notice?.(ctx.strings.get('ui.animals.pastured_over', { animals, pasture: zoneName(ctx, zoneId), fed: feed.supported, n: feed.grazers }), true);
  } else ctx.notice?.(ctx.strings.get('ui.animals.pastured', { animals, pasture: zoneName(ctx, zoneId) }));
  return ids.map((animalId) => ({ type: 'AssignPasture', animalId, zoneId }));
}

/**
 * A tame row's animals counted, as the line under the list and `[p]`'s notice say them: "2 sheep",
 * "8 cows", "1 cow" (the species' plural from `creatures.md` § Plurals), or an animal's own name.
 */
function groupWords(ctx: PanelContext, r: AnimalsReader, ids: readonly EntityId[]): string {
  const creature = ctx.readers.entities.get(ids[0] ?? 0, C.Creature);
  const def = r.def(creature?.species ?? 0);
  if (creature !== undefined && named(creature.name, def)) return creature.name;
  const row = ctx.registry.table<{ id: string; name: string; plural?: string }>('creatures').byIndex(creature?.species ?? 0);
  return ids.length === 1 ? `1 ${def?.name ?? '?'}` : `${ids.length} ${speciesPlural(row)}`;
}

/** The Trained column's words: "training" while a training job exists (also for retraining), else war, hunting or ''. */
export function trainStatus(ctx: Pick<PanelContext, 'readers' | 'strings'>, id: EntityId, trained: string): string {
  if (ctx.readers.has('11')) {
    const job = ctx.readers.of<JobsReader>('11').byKey(trainKey(id));
    if (job !== undefined && job.state !== 'done' && job.state !== 'cancelled') return ctx.strings.get('ui.animals.training');
  }
  if (trained === 'war') return ctx.strings.get('ui.animals.trained_war');
  if (trained === 'hunting') return ctx.strings.get('ui.animals.trained_hunting');
  return '';
}

/**
 * A tame row in words (`panels.md` § Animals): how many and of what, bleeding or wounded, the
 * pasture, how fed, how many are pregnant, the training, the dwarf they are with and the slaughter
 * mark ("6 cows · pasture #1 · fed · 2 pregnant", "Bramble the dog · bleeding · no pasture").
 */
export function tameDetail(ctx: PanelContext, r: AnimalsReader, ids: readonly EntityId[]): string {
  const s = ctx.strings;
  const id = ids[0];
  if (id === undefined) return '';
  const creature = ctx.readers.entities.get(id, C.Creature);
  const tame = ctx.readers.entities.get(id, C.Tame);
  if (creature === undefined || tame === undefined) return '';
  const def = r.def(creature.species);
  const species = def?.name ?? '?';
  const parts: string[] = [];
  parts.push(named(creature.name, def) ? s.get('ui.animals.detail.named', { name: creature.name, species }) : groupWords(ctx, r, ids));
  // Its wounds next, where the two rows never cut them (17's `Body`).
  const hurt = hurtLevel(ctx.readers, id);
  if (hurt > 0) parts.push(s.get(hurt === 2 ? 'ui.animals.detail.bleeding' : 'ui.animals.detail.wounded'));
  const pasture = r.pastureOf(id);
  parts.push(pasture === 0 ? s.get('ui.animals.detail.no_pasture')
    : s.get('ui.animals.detail.pasture', { n: (buildings(ctx)?.zonesOfType('pasture') ?? []).indexOf(pasture) + 1 }));
  const fed = fedLevel(r, id, creature.species);
  if (fed !== null) parts.push(s.get(`ui.animals.fed.${fed}`));
  const now = ctx.readers.calendar.tick;
  const pregnant = ids.filter((a) => (ctx.readers.entities.get(a, C.Tame)?.pregnantUntil ?? 0) > now).length;
  if (pregnant > 0) parts.push(ids.length === 1 ? s.get('ui.animals.detail.pregnant') : s.get('ui.animals.detail.pregnant_n', { n: pregnant }));
  const status = trainStatus(ctx, id, tame.trained);
  if (status !== '') parts.push(s.get(status === s.get('ui.animals.training') ? 'ui.animals.detail.training' : tame.trained === 'war' ? 'ui.animals.detail.trained_war' : 'ui.animals.detail.trained_hunting'));
  if (tame.assignedTo !== 0) parts.push(s.get('ui.animals.detail.with', { name: ctx.readers.entities.get(tame.assignedTo, C.Creature)?.name ?? '' }));
  if (tame.slaughter) parts.push(s.get('ui.animals.detail.slaughter'));
  return parts.join(' · ');
}

export function drawAnimalsPanel(s: Surface, rect: Rect, panel: AnimalsPanel, ctx: PanelContext): void {
  const r = panel.reader(ctx); if (r === null) return;
  const col = rect.col + 1; const width = rect.cols - 2;
  label(s, col, rect.row, ctx.strings.get('ui.animals.tabs', { tame: r.tameList().length, wild: r.wildList().length }), { fg: s.theme.key, width });
  const groups = panel.groups(ctx);
  const str = ctx.strings;
  const pastures = buildings(ctx)?.zonesOfType('pasture') ?? [];
  const pastureText = (id: EntityId): string => (r.pastureOf(id) === 0 ? '—' : `#${pastures.indexOf(r.pastureOf(id)) + 1}`);
  // The selected tame row in words, under the list: what the columns say, and what they do not.
  const chosen = panel.tab === 0 ? groups[Math.min(panel.list.selected, groups.length - 1)] : undefined;
  const detail = chosen === undefined ? [] : wrapText(tameDetail(ctx, r, chosen), width, 2);
  // A bleeding row's words are drawn in the alert colour.
  const detailFg = chosen !== undefined && hurtLevel(ctx.readers, chosen[0] ?? 0) === 2 ? s.theme.alert : s.theme.dim;
  const height = Math.max(2, rect.rows - (panel.tab === 0 ? 8 : 7) - detail.length);
  table(s, { col, row: rect.row + 1, cols: width, rows: height },
    panel.tab === 0
      ? [{ title: str.get('ui.animals.col.animal'), width: 13, mark: true }, { title: str.get('ui.animals.col.pasture'), width: 8 }, { title: str.get('ui.animals.col.fed'), width: 4 }, { title: str.get('ui.animals.col.trained'), width: 9 }]
      : [{ title: str.get('ui.animals.col.species'), width: 14, mark: true }, { title: str.get('ui.animals.col.hunt'), width: 6 }, { title: str.get('ui.animals.col.state'), width: 14 }],
    groups.map((ids) => {
      const id = ids[0] as EntityId;
      const creature = ctx.readers.entities.get(id, C.Creature);
      const tame = ctx.readers.entities.get(id, C.Tame);
      const def = r.def(creature?.species ?? 0);
      const species = def?.name ?? '?';
      if (tame === undefined) {
        const count = r.bySpecies(creature?.species ?? 0, true).length;
        const hunt = ctx.readers.has('09') && ctx.readers.of<ForagingReader>('09').isHuntable(creature?.species ?? 0);
        return [`${species} ×${count}`, str.get(hunt ? 'ui.animals.hunt_on' : 'ui.animals.hunt_off'), r.state(id)];
      }
      // A wounded row starts with the status bar's wounded mark, where no cut reaches it.
      const mark = hurtLevel(ctx.readers, id) > 0 ? str.get('ui.animals.hurt_mark') : '';
      const animal = mark + (named(creature?.name ?? '', def) ? `${species} ${creature?.name ?? ''}` : ids.length > 1 ? `${species} ×${ids.length}` : species);
      return [animal, pastureText(id), fedBar(fedLevel(r, id, creature?.species ?? 0)), trainStatus(ctx, id, tame.trained)];
    }), panel.list, (i) => { panel.list.selected = i; });
  let row = rect.row + height + 1;
  for (const line of detail) { label(s, col, row, line, { fg: detailFg, width, keys: false }); row += 1; }
  separator(s, col, row, width); row += 1;
  if (panel.tab === 0) {
    if (panel.capEditor !== null) {
      const editor = panel.capEditor;
      // The cap is a number field: its keys, and so its captions, are not rebound.
      asWritten(s, () => {
        label(s, col, row, ctx.strings.get('ui.animals.cap'), { width }); row += 1;
        numberField(s, col, row, editor.value, delta => panel.adjustCap(delta), { min: BREEDING_CAP_MIN, max: BREEDING_CAP_MAX, width: 3 }); row += 1;
        const n = button(s, col, row, 'Enter', ctx.strings.get('ui.animals.cap_set'), () => { const cmd = panel.finishCap(); if (cmd) ctx.submit(cmd); });
        button(s, col + n + 1, row, 'Esc', ctx.strings.get('ui.text_input.cancel'), () => { panel.capEditor = null; }); row += 1;
        label(s, col, row, ctx.strings.get('ui.animals.cap_keys'), { width });
      });
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
      // The panel's letters come before the panel letters; slaughter stays on `Shift` (D-253).
      label(s, col, row, ctx.strings.get('ui.animals.actions1'), { width }); row += 1;
      captionButtons(s, col, row, ctx.strings.get('ui.animals.actions2'), [() => panel.startCap(ctx)], { width }); row += 1;
      button(s, col, row, acceleratorLabel('t', ctx.shiftLetters).slice(1, -1), ctx.strings.get('ui.animals.train'), () => panel.startTrain(ctx)); row += 1;
      const species = ctx.readers.entities.get(panel.selected(ctx), C.Creature)?.species;
      if (species !== undefined) label(s, col, row, panel.name.focused ? ctx.strings.get('ui.animals.name_prompt') : ctx.strings.get('ui.animals.cap_line', { n: r.breedingCap(species) }), { width });
      if (panel.name.focused) textField(s, col + 6, row, Math.max(1, width - 10), panel.name);
    }
  } else {
    label(s, col, row, ctx.strings.get('ui.animals.hunt_keys'), { width });
  }
}
