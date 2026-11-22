/**
 * When the thing in view is gone (24 § Inspection): a creature's or an item's view outlives its
 * thing. It keeps its title, says what happened (died, with the cause and the body as a link; used
 * up, eaten, built in or merged; out of sight; left the map), gives the last place, and ends follow.
 * It never falls back silently to a tile. Also the keys at the foot of both views, each a button.
 */

import { formatDate } from '@core/calendar';
import { C } from '@core/components';
import type { ReaderSet } from '@core/readers';
import type { Registry } from '@core/registry';
import type { EntityId, TileIndex } from '@core/types';
import type { Rect } from '@render/cellbuffer';
import type { Rgb } from '@render/palette';
import type { ItemsReader } from '@systems/items';
import { deathLineKey, killerWords } from '../announcements';
import { wrapHang } from '../messages';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { captionButtons, label, separator } from '../widgets';
import { drawSpanRow, stringSpans, wrapSpans, type LinkSink, type LookTarget, type Span } from './look-links';

/** What the fortress heard of a thing's end, from the event that ended it (presentation state). */
export type LookEnd =
  | { readonly kind: 'died'; readonly cause: string; readonly killer: string; readonly tick: number; corpse: EntityId }
  | { readonly kind: 'destroyed'; readonly reason: string };

/** How a thing in view is gone (24 § Inspection), or null while the map shows it. */
export type GoneState =
  | { readonly kind: 'died'; readonly cause: string; readonly killer: string; readonly tick: number; readonly corpse: EntityId }
  | { readonly kind: 'used'; readonly reason: string }
  | { readonly kind: 'hidden' }
  | { readonly kind: 'left' };

/**
 * A creature the map does not show: dead (its death was heard), out of sight (it lives, a stealthed
 * hostile or on unseen ground), or left the map (it no longer exists and did not die).
 */
export function creatureGone(readers: ReaderSet, id: EntityId, shown: boolean, end: LookEnd | undefined): GoneState | null {
  if (shown) return null;
  if (end?.kind === 'died') return { kind: 'died', cause: end.cause, killer: end.killer, tick: end.tick, corpse: end.corpse };
  if (readers.entities.alive(id) && readers.entities.has(id, C.Creature)) return { kind: 'hidden' };
  return { kind: 'left' };
}

/**
 * An item the map does not show: out of sight while it still exists (unseen ground, a hostile the
 * map does not draw holds it), else used up by the reason its destruction gave, or plain gone.
 */
export function itemGone(readers: ReaderSet, id: EntityId, shown: boolean, end: LookEnd | undefined): GoneState | null {
  if (shown) return null;
  const exists = readers.entities.alive(id) && readers.has('13') && readers.of<ItemsReader>('13').get(id) !== undefined;
  if (exists) return { kind: 'hidden' };
  return { kind: 'used', reason: end?.kind === 'destroyed' ? end.reason : 'gone' };
}

/** What a gone view knows besides its state: the name, the dim line kept from when it was seen, the last carrier, the last tile. */
export interface GoneFacts {
  readonly name: string;
  readonly sub: string;
  readonly holder: EntityId;
  readonly last: TileIndex | null;
}

/** The keys at the foot of a creature's or an item's view, and what each does when its button is clicked. */
export interface LookFoot {
  readonly following: boolean;
  centre(): void;
  follow(): void;
  here(): void;
  back(): void;
  link(): void;
}

/**
 * The foot of a creature's or an item's view in its last `rows` rows (3 when there is room, else 0):
 * a rule, then `[c] center  [f] follow off` and `[h] here  [Bksp] back  [Tab] link`, every key a
 * button. A gone view offers `[c] center  [h] that tile` and `[Bksp] back  [Tab] link`.
 */
export function drawLookFoot(s: Surface, rect: Rect, strings: Strings, foot: LookFoot | undefined, gone: boolean): void {
  const width = rect.cols - 2;
  const row = rect.row + rect.rows - 3;
  separator(s, rect.col + 1, row, width);
  const nothing = (): void => {};
  const f: LookFoot = foot ?? { following: false, centre: nothing, follow: nothing, here: nothing, back: nothing, link: nothing };
  if (gone) {
    captionButtons(s, rect.col + 1, row + 1, strings.get('ui.look.gone_keys'), [() => f.centre(), () => f.here()], { width });
  } else {
    const state = strings.get(f.following ? 'ui.look.follow_on' : 'ui.look.follow_off');
    captionButtons(s, rect.col + 1, row + 1, strings.get('ui.look.view_keys', { state }), [() => f.centre(), () => f.follow()], { width });
  }
  captionButtons(s, rect.col + 1, row + 2, strings.get(gone ? 'ui.look.gone_keys2' : 'ui.look.view_keys2'), gone ? [() => f.back(), () => f.link()] : [() => f.here(), () => f.back(), () => f.link()], { width });
}

/** The rows a view's foot takes in `rows` rows of body: 3 with room for at least four more, else none. */
export function footRows(rows: number): number {
  return rows >= 7 ? 3 : 0;
}

/** A dead creature's cause, as its log line says it: "Roald Deephelm has been killed by a hillfolk bandit." */
function causeText(strings: Strings, name: string, state: { cause: string; killer: string }): string {
  if (state.cause === 'faded') return strings.get('announce.summon_faded', { name });
  const key = deathLineKey(strings, state.cause, state.killer) ?? 'ui.look.died';
  return strings.get(key, { name, killer: state.killer });
}

/** The killer of a death event in the words its line uses ("a hillfolk bandit"), or ''. */
export function deathKiller(registry: Registry, event: Readonly<Record<string, unknown>>): string {
  if (Number(event['killerId'] ?? 0) === 0) return '';
  const name = typeof event['killerName'] === 'string' ? event['killerName'] : undefined;
  return killerWords(registry, name, typeof event['killerSpecies'] === 'number' ? event['killerSpecies'] : undefined);
}

/**
 * A gone view (24 § Inspection): the dim line kept from when it was seen, what happened in the alert
 * colour, the cause of a death or the last carrier of an item, the last place, and for a death the
 * body as a link while it lies there. The keys at the foot.
 */
export function drawGoneView(
  s: Surface,
  rect: Rect,
  readers: ReaderSet,
  strings: Strings,
  state: GoneState,
  facts: GoneFacts,
  sink: LinkSink,
  foot?: LookFoot,
  itemTitle?: (id: EntityId) => string,
): void {
  const t = s.theme;
  if (rect.rows <= 0) return;
  const width = rect.cols - 2;
  const footer = footRows(rect.rows);
  const bottom = rect.row + rect.rows - footer;
  let row = rect.row;
  const line = (text: string, fg: Rgb): void => {
    for (const part of wrapHang(text, width, 0)) {
      if (row >= bottom) return;
      label(s, rect.col + 1, row, part, { fg, width, keys: false });
      row += 1;
    }
  };
  const spans = (parts: readonly Span[], fg: Rgb): void => {
    for (const r of wrapSpans(parts, width, 2)) {
      if (row >= bottom) return;
      drawSpanRow(s, rect.col + 1, row, width, r, fg, sink);
      row += 1;
    }
  };
  if (facts.sub !== '') line(facts.sub, t.dim);
  const p = facts.last === null ? null : readers.map.unpack(facts.last);
  if (state.kind === 'died') {
    line(strings.get('ui.look.died_on', { date: formatDate(state.tick) }), t.bad);
    line(causeText(strings, facts.name, state), t.text);
  } else if (state.kind === 'hidden') line(strings.get('ui.look.out_of_sight'), t.alert);
  else if (state.kind === 'left') line(strings.get('ui.look.left_map'), t.alert);
  else line(strings.get(strings.has(`ui.look.end.${state.reason}`) ? `ui.look.end.${state.reason}` : 'ui.look.end.gone'), t.alert);
  // An item's last carrier, a link while the map shows it.
  if (facts.holder !== 0 && readers.entities.has(facts.holder, C.Creature)) {
    const c = readers.entities.get(facts.holder, C.Creature);
    const shown = readers.entities.alive(facts.holder) && state.kind !== 'hidden';
    const who: Span[] = [{ text: c?.name ?? '', target: shown ? { kind: 'creature', id: facts.holder } : undefined }];
    spans(stringSpans(strings, 'ui.look.last_carried', { who }), t.text);
  }
  if (p !== null) line(strings.get(state.kind === 'hidden' ? 'ui.look.last_seen_at' : 'ui.look.last_at', p), t.value);
  if (state.kind === 'hidden') line(strings.get('ui.look.seen_again'), t.dim);
  // The body, while it lies there: a row that opens its view.
  if (state.kind === 'died' && state.corpse !== 0 && readers.has('13') && readers.of<ItemsReader>('13').get(state.corpse) !== undefined && row + 2 < bottom) {
    row += 1;
    line(strings.get('ui.look.body_lies'), t.dim);
    const target: LookTarget = { kind: 'item', id: state.corpse };
    spans([{ text: itemTitle?.(state.corpse) ?? '', target }], t.text);
  }
  if (footer > 0) drawLookFoot(s, rect, strings, foot, true);
}
