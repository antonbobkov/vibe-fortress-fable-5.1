/** Finished fortress list and record (24 § The legend record). */
import { SEASON_NAMES } from '@core/calendar';
import { SEASONS_PER_YEAR, TICKS_PER_YEAR } from '@core/constants';
import type { KeyPress } from '@platform/input';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import type { KeyContext } from '../keymap';
import { seasonName } from '../panels/calendar';
import { Strings } from '../strings';
import type { Surface } from '../surface';
import { button } from '../widgets';

/** The default table, for a legend drawn without the game's strings. */
const DEFAULT_STRINGS = new Strings();

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

/** The legend's note on a testing fortress (24 § The legend record), as the default table gives it. */
export const LEGEND_TESTING_NOTE = DEFAULT_STRINGS.get('ui.legend.testing_note');

export function legendLines(record: LegendRecord, strings: Strings = DEFAULT_STRINGS): string[] {
  const foundedSeason = SEASON_NAMES[Math.floor(record.foundedTick / (TICKS_PER_YEAR / SEASONS_PER_YEAR)) % SEASONS_PER_YEAR] ?? 'spring';
  const foundedYear = Math.floor(record.foundedTick / TICKS_PER_YEAR) + 1;
  const testing = record.testing === true;
  return [
    testing ? strings.get('ui.legend.name_testing', { name: record.name }) : record.name,
    ...(testing ? [strings.get('ui.legend.testing_note')] : []),
    strings.get('ui.legend.founded', { season: seasonName(strings, foundedSeason), year: foundedYear, region: record.region, biome: record.biome, wealth: record.wealthRating, peril: record.perilRating }),
    record.cause,
    strings.get('ui.legend.stats', { years: record.yearsSurvived, days: record.daysSurvived, peak: record.peakPopulation, deepest: record.deepestLevel, wealth: record.finalWealth.toLocaleString('en-US') }),
    strings.get(testing ? 'ui.legend.milestones_testing' : 'ui.legend.milestones'),
    ...record.milestones.map((entry) => `  ${entry.date}  ${entry.text}`),
    strings.get('ui.legend.notable'),
    ...record.killsOfNote.map((entry) => `  ${entry}`),
    strings.get('ui.legend.last_words'),
    ...record.lastWords.map((entry) => `  ${entry}`),
  ];
}

/** The record's rows on a surface of `rows`: below the title, above the scroll line and the buttons. */
function legendRows(rows: number): number {
  return Math.max(0, rows - 5);
}

export interface LegendHost {
  back(): void;
  /** A fortress's end: `Enter` goes to the world map of its world for a new embark (T-672). */
  embarkAgain?(): void;
  /** The game's strings; absent, the default table. */
  readonly strings?: Strings;
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
    const strings = this.host.strings ?? DEFAULT_STRINGS;
    surface.text(2, 1, strings.get(this.detail ? 'ui.legend.title_one' : 'ui.legend.title'), key);
    if (this.detail) {
      const record = this.records[this.selected];
      if (record !== undefined) {
        const lines = legendLines(record, strings);
        const visible = legendRows(surface.rows);
        this.scroll = Math.min(this.scroll, Math.max(0, lines.length - visible));
        for (let i = 0; i < visible && i + this.scroll < lines.length; i += 1) {
          const line = lines[i + this.scroll] as string;
          surface.text(2, 3 + i, Array.from(line).slice(0, Math.max(0, surface.cols - 4)).join(''), text);
        }
        if (lines.length > visible) surface.text(2, surface.rows - 2, strings.get('ui.legend.scroll', { at: this.scroll + 1, n: lines.length }), dim);
      }
    } else if (this.records.length === 0) surface.text(2, 3, strings.get('ui.legend.none'), dim);
    else {
      for (let i = 0; i < this.records.length && i < surface.rows - 5; i += 1) {
        const record = this.records[i] as LegendRecord;
        const line = strings.get(record.testing === true ? 'ui.legend.row_testing' : 'ui.legend.row', { marker: i === this.selected ? '▶' : ' ', name: record.name, region: record.region, year: Math.floor(record.endedTick / TICKS_PER_YEAR) + 1 });
        surface.text(2, i + 3, line, i === this.selected ? key : text);
        surface.hit({ col: 2, row: i + 3, cols: Math.min(surface.cols - 4, Array.from(line).length), rows: 1 }, () => {
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
      const page = Math.max(1, legendRows(this.last?.rows ?? 0) - 1);
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

  /** The record's last scroll offset: its last page starts there, so `↓` stops at the last line (T-720). */
  maxScroll(): number {
    const record = this.records[this.selected];
    if (record === undefined || this.last === null) return 0;
    return Math.max(0, legendLines(record, this.host.strings ?? DEFAULT_STRINGS).length - legendRows(this.last.rows));
  }

  private scrollBy(delta: number): void {
    this.scroll = Math.max(0, Math.min(this.maxScroll(), this.scroll + delta));
  }
}
