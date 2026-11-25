/**
 * A tame grazer's view in Look offers its pasture (08 § Player-facing behavior: "clicking an animal and
 * choosing "Pasture""; 24 § Inspection): the foot's `[p] pasture` row names the pasture it is on, and
 * `[p]` or that row opens a picker of every pasture with what its grass will feed once the animal is
 * on it ("Feeds 0 of 6 grazers", in the alert colour when it is too small) and "Off pasture". Choosing
 * one sends `AssignPasture` and says on the status row what it did, as the Animals panel's `[p]` does.
 * Presentation state, not saved.
 */

import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { ReaderSet } from '@core/readers';
import type { EntityId } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { KeyPress } from '@platform/input';
import type { AnimalsReader } from '@systems/animals';
import type { BuildingsReader } from '@systems/buildings';
import { zoneName } from '../messages';
import { feedsText, overGrazed, pastureFeed } from '../pasture';
import type { Surface } from '../surface';
import { button, label } from '../widgets';
import { assignPasture } from './animals';
import type { PanelContext } from './context';

/** Whether a creature is a tame grazer of the fortress, the one kind `AssignPasture` takes (08 § Pastures and feeding). */
export function pastureGrazer(readers: ReaderSet, id: EntityId): boolean {
  if (id === 0 || !readers.has('08') || !readers.entities.alive(id)) return false;
  const animals = readers.of<AnimalsReader>('08');
  if (!readers.entities.has(id, C.Tame) || !animals.tameList().includes(id)) return false;
  return animals.def(readers.entities.get(id, C.Creature)?.species ?? 0)?.diet === 'grazer';
}

/** One choice of the picker: a pasture with its verdict, or off pasture (`zoneId` 0, no verdict). */
export interface PastureOption {
  readonly zoneId: EntityId;
  readonly name: string;
  readonly verdict: string;
  /** The pasture would hold more grazers than its grass feeds. */
  readonly over: boolean;
}

/** "Off pasture", then every pasture in zone order with what it feeds with `id` on it. */
export function pastureOptions(ctx: PanelContext, id: EntityId): PastureOption[] {
  const out: PastureOption[] = [{ zoneId: 0, name: ctx.strings.get('ui.look.pasture.off'), verdict: '', over: false }];
  if (!ctx.readers.has('14')) return out;
  for (const zoneId of ctx.readers.of<BuildingsReader>('14').zonesOfType('pasture')) {
    const feed = pastureFeed(ctx.readers, zoneId, [id]);
    if (feed === null) continue;
    out.push({ zoneId, name: zoneName(ctx, zoneId), verdict: feedsText(ctx.strings, feed), over: overGrazed(feed) });
  }
  return out;
}

/** The foot's row of a tame grazer's view: "[p] pasture: Pasture #1", "[p] pasture: none". */
export function pastureFootText(ctx: PanelContext, id: EntityId): string {
  const zoneId = ctx.readers.of<AnimalsReader>('08').pastureOf(id);
  return ctx.strings.get('ui.look.pasture.keys', { pasture: zoneId === 0 ? ctx.strings.get('ui.look.pasture.none') : zoneName(ctx, zoneId) });
}

/** The picker of a tame grazer's view: closed, or open for one animal with a choice selected. */
export class PastureChoice {
  /** The animal it is open for; 0 while it is closed. */
  animalId: EntityId = 0;
  selected = 0;

  /** Open for `id` with its pasture now selected. */
  open(ctx: PanelContext, id: EntityId): void {
    this.animalId = id;
    const now = ctx.readers.of<AnimalsReader>('08').pastureOf(id);
    this.selected = Math.max(0, pastureOptions(ctx, id).findIndex((o) => o.zoneId === now));
  }

  close(): void {
    this.animalId = 0;
  }

  /** Whether it is open for the creature `id`, still a tame grazer; a picker left open for another is closed. */
  showing(readers: ReaderSet, id: EntityId): boolean {
    if (this.animalId === 0) return false;
    if (this.animalId !== id || !pastureGrazer(readers, id)) this.close();
    return this.animalId !== 0;
  }

  /** The choice made: `AssignPasture`, with its status line, and the picker closed. */
  choose(ctx: PanelContext, index = this.selected): Command[] {
    const option = pastureOptions(ctx, this.animalId)[index];
    const id = this.animalId;
    this.close();
    return option === undefined ? [] : assignPasture(ctx, [id], option.zoneId);
  }

  /**
   * The picker's keys, as the Animals panel's training choice takes them: `↑` `↓` move, `Enter`
   * chooses, `Backspace` or `Esc` closes it. Others are left to the screen.
   */
  key(ctx: PanelContext, press: KeyPress, submit: (cmds: readonly Command[]) => void): boolean {
    const k = press.key;
    const n = pastureOptions(ctx, this.animalId).length;
    if (k === 'ArrowUp' || k === '↑' || k === 'ArrowDown' || k === '↓') {
      const step = k === 'ArrowUp' || k === '↑' ? -1 : 1;
      this.selected = (this.selected + step + n) % n;
      return true;
    }
    if (k === 'Enter') { submit(this.choose(ctx)); return true; }
    if (k === 'Backspace' || k === 'Esc' || k === 'Escape') { this.close(); return true; }
    return false;
  }
}

/**
 * The picker in `rect`, in place of the view's sections: "Pasture for the cow:", "Off pasture", each
 * pasture with its verdict at the right (in the alert colour when it is too small, dim otherwise),
 * then `[Enter] choose  [Esc] cancel`. A click on a row chooses it.
 */
export function drawPastureChoice(s: Surface, rect: Rect, ctx: PanelContext, choice: PastureChoice, submit: (cmds: readonly Command[]) => void): void {
  const t = s.theme;
  const col = rect.col + 1;
  const width = rect.cols - 2;
  const bottom = rect.row + rect.rows;
  let row = rect.row;
  if (row >= bottom) return;
  const id = choice.animalId;
  const creature = ctx.readers.entities.get(id, C.Creature);
  const species = ctx.readers.of<AnimalsReader>('08').def(creature?.species ?? 0)?.name ?? '';
  const animal = creature === undefined || creature.name === '' || creature.name === species ? `the ${species}` : creature.name;
  label(s, col, row, ctx.strings.get('ui.look.pasture.prompt', { animal }), { fg: t.key, width });
  row += 1;
  const options = pastureOptions(ctx, id);
  // Rows past the space left keep the keys' row in view; the selection is always among those shown.
  const room = Math.max(1, bottom - row - 1);
  const first = Math.max(0, Math.min(choice.selected - room + 1, options.length - room));
  for (let k = first; k < options.length && row < bottom - 1; k += 1) {
    const option = options[k] as PastureOption;
    const selected = k === choice.selected;
    const cells = { col, row, cols: width, rows: 1 };
    const verdict = Array.from(option.verdict).length;
    const nameWidth = verdict === 0 ? width : Math.max(4, width - verdict - 1);
    label(s, col, row, `${selected ? '▶ ' : '  '}${option.name}`, { fg: selected ? t.value : t.text, width: nameWidth, keys: false });
    if (verdict > 0) label(s, col + width - verdict, row, option.verdict, { fg: option.over ? t.alert : t.dim, width: verdict, keys: false });
    if (selected) s.invert(cells);
    s.hit(cells, () => submit(choice.choose(ctx, k)));
    row += 1;
  }
  if (row >= bottom) return;
  const n = button(s, col, row, 'Enter', ctx.strings.get('ui.look.pasture.choose'), () => submit(choice.choose(ctx)));
  button(s, col + n + 2, row, 'Esc', ctx.strings.get('ui.text_input.cancel'), () => choice.close());
}
