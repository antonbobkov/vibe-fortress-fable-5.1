/**
 * Names that open what they name (24 § Inspection): a line of Look's creature and item views as
 * spans of text, some of them links to a creature, an item, a building or a zone. The spans wrap
 * like any line of the view, and a link is drawn in the value colour with a click region; `Tab`
 * moves the focus through the links in view and `Enter` opens the focused one.
 */

import type { EntityId } from '@core/types';
import type { Rgb } from '@render/palette';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { label } from '../widgets';

/** A thing Look can open: a creature's view, an item's view, a building's panel, a zone's inspector (24 § Inspection). */
export type LookTarget =
  | { readonly kind: 'creature'; readonly id: EntityId }
  | { readonly kind: 'item'; readonly id: EntityId }
  | { readonly kind: 'building'; readonly id: EntityId }
  | { readonly kind: 'zone'; readonly id: EntityId };

/** A piece of a line: plain text, or a name that opens its target. */
export interface Span {
  readonly text: string;
  readonly target?: LookTarget | undefined;
  /** Its own colour for plain text (a field's dim label); the line's colour otherwise. */
  readonly fg?: Rgb | undefined;
}

/** The plain text of a line of spans. */
export function spansText(spans: readonly Span[]): string {
  return spans.map((span) => span.text).join('');
}

/** Lists of spans joined by a plain separator: "iron spear, iron helm". */
export function joinSpans(lists: readonly (readonly Span[])[], separator: string): Span[] {
  const out: Span[] = [];
  lists.forEach((list, n) => {
    if (n > 0) out.push({ text: separator });
    out.push(...list);
  });
  return out;
}

/**
 * A string of the table with some of its arguments given as spans: "Carried by {who}" with `who` a
 * link. The plain arguments are filled as `Strings.get` fills them.
 */
export function stringSpans(strings: Strings, key: string, args: Readonly<Record<string, string | number | readonly Span[]>>): Span[] {
  const plain: Record<string, string | number> = {};
  const slots: (readonly Span[])[] = [];
  for (const [name, value] of Object.entries(args)) {
    if (typeof value === 'string' || typeof value === 'number') plain[name] = value;
    else {
      plain[name] = `\u0001${slots.length}\u0002`;
      slots.push(value);
    }
  }
  const out: Span[] = [];
  for (const part of strings.get(key, plain).split(/(\u0001\d+\u0002)/)) {
    const slot = /^\u0001(\d+)\u0002$/.exec(part);
    if (slot !== null) out.push(...(slots[Number(slot[1])] ?? []));
    else if (part !== '') out.push({ text: part });
  }
  return out;
}

/** One row of a wrapped line: the cells it is indented by, then its runs of text, each with its span. */
export interface SpanRow {
  readonly indent: number;
  readonly runs: readonly { readonly text: string; readonly span: Span }[];
}

/**
 * A line of spans broken at spaces to `width` cells. The rows after the first are indented by
 * `indent`, by default under the text after the first word (as the creature view's lines hang).
 */
export function wrapSpans(spans: readonly Span[], width: number, indent?: number): SpanRow[] {
  const chars: { ch: string; span: Span }[] = [];
  for (const span of spans) for (const ch of Array.from(span.text)) chars.push({ ch, span });
  const firstSpace = chars.findIndex((c) => c.ch === ' ');
  const hang = indent ?? firstSpace + 1;
  const words: { start: number; end: number }[] = [];
  for (let k = 0; k < chars.length;) {
    if (chars[k]?.ch === ' ') {
      k += 1;
      continue;
    }
    const start = k;
    while (k < chars.length && chars[k]?.ch !== ' ') k += 1;
    words.push({ start, end: k });
  }
  const ranges: { start: number; end: number }[] = [];
  for (const word of words) {
    const last = ranges[ranges.length - 1];
    if (last === undefined || (ranges.length > 1 ? hang : 0) + (word.end - last.start) > width) ranges.push({ ...word });
    else last.end = word.end;
  }
  return ranges.map((range, n) => {
    const runs: { text: string; span: Span }[] = [];
    for (let k = range.start; k < range.end; k += 1) {
      const c = chars[k] as { ch: string; span: Span };
      const run = runs[runs.length - 1];
      if (run !== undefined && run.span === c.span) run.text += c.ch;
      else runs.push({ text: c.ch, span: c.span });
    }
    return { indent: n === 0 ? 0 : hang, runs };
  });
}

/** Where the links of a view are kept as it draws: their targets in order, the focused one, and what a click opens. */
export interface LinkSink {
  readonly links: LookTarget[];
  readonly focus: number;
  readonly open?: ((target: LookTarget) => void) | undefined;
  /** The index each span drawn so far has among the links, so a link broken over two rows is one. */
  readonly seen: Map<Span, number>;
}

/** Draw one row of spans at a cell: plain runs in `fg`, links in the value colour (inverted when focused) with a click region. */
export function drawSpanRow(s: Surface, col: number, row: number, width: number, line: SpanRow, fg: Rgb, sink: LinkSink | null): void {
  const t = s.theme;
  let c = col + line.indent;
  const end = col + width;
  for (const run of line.runs) {
    if (c >= end) return;
    const cells = Math.min(Array.from(run.text).length, end - c);
    const target = run.span.target;
    if (target === undefined || sink === null) label(s, c, row, run.text, { fg: run.span.fg ?? fg, width: end - c, keys: false });
    else {
      let n = sink.seen.get(run.span);
      if (n === undefined) {
        n = sink.links.length;
        sink.seen.set(run.span, n);
        sink.links.push(target);
      }
      const focused = sink.focus === n;
      label(s, c, row, run.text, { fg: focused ? t.black : t.value, bg: focused ? t.value : t.black, width: end - c, keys: false });
      const open = sink.open;
      if (open !== undefined) s.hit({ col: c, row, cols: cells, rows: 1 }, () => open(target));
    }
    c += cells;
  }
}
