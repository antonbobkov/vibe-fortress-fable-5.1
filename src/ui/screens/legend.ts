/** Finished fortress list and record (24 § The legend record). */
import { SEASON_NAMES } from '@core/calendar';
import { SEASONS_PER_YEAR, TICKS_PER_YEAR } from '@core/constants';
import type { KeyPress } from '@platform/input';
import { clickHit, type CellPointer, type CellWheel, type Screen } from '../screen';
import type { KeyContext } from '../keymap';
import type { Surface } from '../surface';
import { button } from '../widgets';

export interface LegendRecord {
  readonly id: string;
  readonly name: string;
  readonly seed: string;
  readonly region: string;
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
}

export function legendLines(record: LegendRecord): string[] {
  const foundedSeason = SEASON_NAMES[Math.floor(record.foundedTick / (TICKS_PER_YEAR / SEASONS_PER_YEAR)) % SEASONS_PER_YEAR] ?? 'spring';
  const foundedYear = Math.floor(record.foundedTick / TICKS_PER_YEAR) + 1;
  return [
    record.name,
    `Founded ${foundedSeason[0]?.toUpperCase()}${foundedSeason.slice(1)}, Year ${foundedYear} at ${record.region} (${record.biome}, wealth ${record.wealthRating}, peril ${record.perilRating})`,
    record.cause,
    `Years ${record.yearsSurvived} · Days ${record.daysSurvived} · Peak population ${record.peakPopulation} · Deepest level ${record.deepestLevel} · Wealth ${record.finalWealth.toLocaleString('en-US')} ☼`,
    'Milestones',
    ...record.milestones.map((entry) => `  ${entry.date}  ${entry.text}`),
    'Notable',
    ...record.killsOfNote.map((entry) => `  ${entry}`),
    'Last words (log)',
    ...record.lastWords.map((entry) => `  ${entry}`),
  ];
}

export interface LegendHost { back(): void }

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
    surface.text(2, 1, this.detail ? 'Legend' : 'Legends', key);
    if (this.detail) {
      const record = this.records[this.selected];
      if (record !== undefined) {
        const lines = legendLines(record);
        const visible = Math.max(0, surface.rows - 5);
        for (let i = 0; i < visible && i + this.scroll < lines.length; i += 1) {
          const line = lines[i + this.scroll] as string;
          surface.text(2, 3 + i, Array.from(line).slice(0, Math.max(0, surface.cols - 4)).join(''), text);
        }
        if (lines.length > visible) surface.text(2, surface.rows - 2, `↑↓ Scroll ${this.scroll + 1}/${lines.length}`, dim);
      }
    } else if (this.records.length === 0) surface.text(2, 3, 'No legends recorded.', dim);
    else {
      for (let i = 0; i < this.records.length && i < surface.rows - 5; i += 1) {
        const record = this.records[i] as LegendRecord;
        const line = `${i === this.selected ? '▶' : ' '} ${record.name} · ${record.region} · Year ${Math.floor(record.endedTick / TICKS_PER_YEAR) + 1}`;
        surface.text(2, i + 3, line, i === this.selected ? key : text);
        surface.hit({ col: 2, row: i + 3, cols: Math.min(surface.cols - 4, Array.from(line).length), rows: 1 }, () => {
          this.selected = i;
          this.detail = true;
        });
      }
    }
    button(surface, 2, surface.rows - 1, 'Esc', 'Back', () => this.back());
  }

  key(press: KeyPress): boolean {
    if (press.key === 'Esc' || press.key === 'Escape') { this.back(); return true; }
    if (press.key === 'ArrowUp' || press.key === '↑') {
      if (this.detail) this.scroll = Math.max(0, this.scroll - 1);
      else this.selected = Math.max(0, this.selected - 1);
      return true;
    }
    if (press.key === 'ArrowDown' || press.key === '↓') {
      if (this.detail) this.scroll += 1;
      else this.selected = Math.min(this.records.length - 1, this.selected + 1);
      return true;
    }
    if (press.key === 'Enter' && !this.detail && this.records.length > 0) { this.detail = true; return true; }
    return false;
  }

  pointerDown(p: CellPointer): void { clickHit(this.last, p); }
  wheel(w: CellWheel): void { if (this.detail) this.scroll = Math.max(0, this.scroll + Math.sign(w.dy)); }
}
