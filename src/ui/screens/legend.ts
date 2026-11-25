/** Finished fortress list and record (24 § The legend record). */
import { SEASON_NAMES } from '@core/calendar';
import { SEASONS_PER_YEAR, TICKS_PER_YEAR } from '@core/constants';
import type { KeyPress } from '@platform/input';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import type { KeyContext } from '../keymap';
import { seasonName } from '../panels/calendar';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { button } from '../widgets';
import { cutText, wrapHang } from '../widgets/label';

export interface LegendRecord {
  readonly id: string;
  readonly name: string;
  readonly seed: string;
  readonly region: string;
  /** The world map region the fortress stood on; absent in a record written before T-672. */
  readonly regionId?: number;
  readonly biome: string;
  readonly wealthRating: number;
  readonly perilRating: number;
  readonly foundedTick: number;
  readonly endedTick: number;
  readonly yearsSurvived: number;
  readonly daysSurvived: number;
  readonly peakPopulation: number;
  readonly deepestLevel: number;
  readonly finalWealth: number;
  readonly milestones: readonly { id: string; date: string; text: string }[];
  readonly killsOfNote: readonly string[];
  readonly lastWords: readonly string[];
  readonly cause: string;
  /** Started in the embark's testing mode (`02` § Testing mode); absent for a normal fortress. */
  readonly testing?: boolean;
}

/** One line of the record, and where its continuation rows start when it wraps. */
interface LegendLine {
  readonly text: string;
  /** The cells a continuation row is indented by. */
  readonly hang: number;
}

/** The record's own indent: a milestone, a deed and a last word stand two cells in. */
const INDENT = '  ';

/**
 * The cause in its lines: the date of the fall is a sentence of its own, and the rest (the last
 * dwarf and how they died) starts the next line (`ui-screens/menus-and-world.md` § Legend).
 */
function causeLines(cause: string): string[] {
  const end = /\.\s+(?=\S)/.exec(cause);
  if (end === null) return [cause];
  return [cause.slice(0, end.index + 1), cause.slice(end.index + end[0].length)];
}

/** A last word's continuation lines up after its `!!` or `!` mark. */
function markHang(entry: string): number {
  const mark = /^!+\s+/.exec(entry);
  return INDENT.length + (mark === null ? INDENT.length : mark[0].length);
}

function legendEntries(record: LegendRecord, strings: Strings): LegendLine[] {
  const foundedSeason = SEASON_NAMES[Math.floor(record.foundedTick / (TICKS_PER_YEAR / SEASONS_PER_YEAR)) % SEASONS_PER_YEAR] ?? 'spring';
  const foundedYear = Math.floor(record.foundedTick / TICKS_PER_YEAR) + 1;
  const testing = record.testing === true;
  const top = (text: string): LegendLine => ({ text, hang: INDENT.length });
  return [
    top(testing ? strings.get('ui.legend.name_testing', { name: record.name }) : record.name),
    ...(testing ? [top(strings.get('ui.legend.testing_note'))] : []),
    top(strings.get('ui.legend.founded', { season: seasonName(strings, foundedSeason), year: foundedYear, region: record.region, biome: record.biome, wealth: record.wealthRating, peril: record.perilRating })),
    ...causeLines(record.cause).map(top),
    top(strings.get('ui.legend.stats', { years: record.yearsSurvived, days: record.daysSurvived, peak: record.peakPopulation, deepest: record.deepestLevel, wealth: record.finalWealth.toLocaleString('en-US') })),
    top(strings.get(testing ? 'ui.legend.milestones_testing' : 'ui.legend.milestones')),
    ...record.milestones.map((entry) => ({ text: `${INDENT}${entry.date}${INDENT}${entry.text}`, hang: INDENT.length * 2 + Array.from(entry.date).length })),
    top(strings.get('ui.legend.notable')),
    ...record.killsOfNote.map((entry) => ({ text: `${INDENT}${entry}`, hang: INDENT.length * 2 })),
    top(strings.get('ui.legend.last_words')),
    ...record.lastWords.map((entry) => ({ text: `${INDENT}${entry}`, hang: markHang(entry) })),
  ];
}

/** The record's lines, each whole: the cause's date sentence and its last dwarf on lines of their own. */
export function legendLines(record: LegendRecord, strings: Strings): string[] {
  return legendEntries(record, strings).map((line) => line.text);
}

/**
 * The record's rows on a screen `width` cells wide: every line wraps at word boundaries, each
 * continuation indented under its line's own text (a last word's after its mark, a milestone's after
 * its date). The scroll counts these rows.
 */
export function legendRows(record: LegendRecord, strings: Strings, width: number): string[] {
  return legendEntries(record, strings).flatMap((line) => wrapHang(line.text, width, line.hang));
}

/** The record's rows on a surface of `rows`: below the title, above the scroll line and the buttons. */
function pageRows(rows: number): number {
  return Math.max(0, rows - 5);
}

/** The width the record's rows wrap at: the surface less two cells each side. */
function rowWidth(cols: number): number {
  return Math.max(1, cols - 4);
}

export interface LegendHost {
  back(): void;
  /** A fortress's end: `Enter` goes to the world map of its world for a new embark (T-672). */
  embarkAgain?(): void;
  /** The game's strings. */
  readonly strings: Strings;
}

export class LegendScreen implements Screen {
  readonly id = 'legend' as const;

  /** The list keys of § Panels; `Esc` is fixed. */
  translatedKeys(): readonly KeyContext[] { return ['panel']; }
  captionKeys(): readonly KeyContext[] { return ['panel']; }
  selected = 0;
  detail = false;
  scroll = 0;
  private last: Surface | null = null;

  constructor(private readonly records: readonly LegendRecord[], private readonly host: LegendHost, openId?: string) {
    if (openId !== undefined) {
      this.selected = Math.max(0, records.findIndex((record) => record.id === openId));
      this.detail = records.length > 0;
    }
  }

  private back(): void {
    if (this.detail && this.records.length > 1) { this.detail = false; this.scroll = 0; }
    else this.host.back();
  }

  draw(surface: Surface): void {
    this.last = surface;
    const { text, key, dim } = surface.theme;
    const strings = this.host.strings;
    surface.text(2, 1, strings.get(this.detail ? 'ui.legend.title_one' : 'ui.legend.title'), key);
    if (this.detail) {
      const record = this.records[this.selected];
      if (record !== undefined) {
        const lines = legendRows(record, strings, rowWidth(surface.cols));
        const visible = pageRows(surface.rows);
        this.scroll = Math.min(this.scroll, Math.max(0, lines.length - visible));
        for (let i = 0; i < visible && i + this.scroll < lines.length; i += 1) {
          surface.text(2, 3 + i, lines[i + this.scroll] as string, text);
        }
        if (lines.length > visible) surface.text(2, surface.rows - 2, strings.get('ui.legend.scroll', { at: this.scroll + 1, n: lines.length }), dim);
      }
    } else if (this.records.length === 0) surface.text(2, 3, strings.get('ui.legend.none'), dim);
    else {
      for (let i = 0; i < this.records.length && i < surface.rows - 5; i += 1) {
        const record = this.records[i] as LegendRecord;
        const line = strings.get(record.testing === true ? 'ui.legend.row_testing' : 'ui.legend.row', { marker: i === this.selected ? '▶' : ' ', name: record.name, region: record.region, year: Math.floor(record.endedTick / TICKS_PER_YEAR) + 1 });
        // A row too long for the screen keeps one row and ends in `»`.
        const shown = cutText(line, rowWidth(surface.cols));
        surface.text(2, i + 3, shown, i === this.selected ? key : text);
        surface.hit({ col: 2, row: i + 3, cols: Array.from(shown).length, rows: 1 }, () => {
          this.selected = i;
          this.detail = true;
        });
      }
    }
    const back = button(surface, 2, surface.rows - 1, 'Esc', strings.get('ui.legend.back'), () => this.back());
    const again = this.host.embarkAgain;
    if (again !== undefined && this.detail) button(surface, 2 + back + 2, surface.rows - 1, 'Enter', strings.get('ui.legend.embark_again'), () => again());
  }

  key(press: KeyPress): boolean {
    if (press.key === 'Esc' || press.key === 'Escape') { this.back(); return true; }
    if (press.key === 'ArrowUp' || press.key === '↑') {
      if (this.detail) this.scroll = Math.max(0, this.scroll - 1);
      else this.selected = Math.max(0, this.selected - 1);
      return true;
    }
    if (press.key === 'ArrowDown' || press.key === '↓') {
      if (this.detail) this.scrollBy(1);
      else this.selected = Math.min(this.records.length - 1, this.selected + 1);
      return true;
    }
    // T-720: a page at a time, and to either end, as the help and log panels do.
    if (this.detail && (press.key === 'PageUp' || press.key === 'PageDown')) {
      const page = Math.max(1, pageRows(this.last?.rows ?? 0) - 1);
      this.scrollBy(press.key === 'PageUp' ? -page : page);
      return true;
    }
    if (this.detail && (press.key === 'Home' || press.key === 'End')) { this.scrollBy(press.key === 'Home' ? -Infinity : Infinity); return true; }
    if (press.key === 'Enter' && !this.detail && this.records.length > 0) { this.detail = true; return true; }
    if (press.key === 'Enter' && this.detail && this.host.embarkAgain !== undefined) { this.host.embarkAgain(); return true; }
    return false;
  }

  pointerDown(p: CellPointer): void { clickHit(this.last, p); }
  wheel(w: CellWheel): void { if (this.detail) this.scrollBy(Math.sign(w.dy)); }

  /** The record's last scroll offset, in wrapped rows: its last page starts there, so `↓` stops at the last row (T-720). */
  maxScroll(): number {
    const record = this.records[this.selected];
    if (record === undefined || this.last === null) return 0;
    return Math.max(0, legendRows(record, this.host.strings, rowWidth(this.last.cols)).length - pageRows(this.last.rows));
  }

  private scrollBy(delta: number): void {
    this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll + delta));
  }
}
