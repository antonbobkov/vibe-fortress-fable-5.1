/**
 * The world generation screen: `04-implementation/ui-screens/menus-and-world.md` § World
 * generation, `02-systems/01-world-generation.md` § Player-facing behavior ("seed field (text; a
 * random seed by default), size selector, a Generate button, a preview that fills in stage by
 * stage, and Continue") and 24 § Screens outside the fortress.
 *
 * Fields, top to bottom: the seed (focused on entry; typing edits it, `Enter` or `Tab` leaves
 * it), the size (`←`/`→` choose), `[g] Generate`. `[r]` draws a new random seed. After a world
 * exists, `Enter` continues to the map; `Esc` goes back.
 */

import { WORLD_SIZE_LARGE, WORLD_SIZE_SMALL, WORLD_SIZE_STANDARD } from '@core/constants';
import type { KeyPress } from '@platform/input';
import type { WorldMapCompositor } from '@render/world-map';
import type { WorldMap } from '@systems/worldgen';
import type { Keymap } from '../keymap';
import { clickHit, type CellPointer, type Screen } from '../screen';
import type { Strings } from '../strings';
import type { Surface } from '../surface';
import { bar, button, editText, label, textField, type TextFieldState } from '../widgets';

export const WORLD_SIZES: readonly { readonly id: 'small' | 'standard' | 'large'; readonly size: number }[] = [
  { id: 'small', size: WORLD_SIZE_SMALL },
  { id: 'standard', size: WORLD_SIZE_STANDARD },
  { id: 'large', size: WORLD_SIZE_LARGE },
];

/** Seed characters kept; longer seeds scroll inside the field. */
export const SEED_MAX_LENGTH = 32;

export interface WorldGenHost {
  randomSeed(): string;
  /** `worldgen.generate(seed, size, onProgress)`; the callback gets each stage as it finishes. */
  generate(seed: string, size: number, onProgress: (stage: string, pct: number) => void): WorldMap;
  back(): void;
  continueTo(world: WorldMap): void;
}

type Field = 'seed' | 'size' | 'generate';
const FIELDS: readonly Field[] = ['seed', 'size', 'generate'];

export interface WorldStats {
  readonly landPct: number;
  readonly mountainPct: number;
  readonly rivers: number;
  readonly volcanoes: number;
}

/** The figures beside the preview. */
export function worldStats(world: WorldMap): WorldStats {
  const n = world.regions.length;
  let land = 0;
  let mountains = 0;
  let volcanoes = 0;
  for (const r of world.regions) {
    if (r.biome !== 'ocean') land += 1;
    if (r.biome === 'mountain' || r.biome === 'alpine') mountains += 1;
    if (r.volcano) volcanoes += 1;
  }
  return {
    landPct: n === 0 ? 0 : Math.round((land * 100) / n),
    mountainPct: n === 0 ? 0 : Math.round((mountains * 100) / n),
    rivers: world.rivers.length,
    volcanoes,
  };
}

export class WorldGenScreen implements Screen {
  readonly id = 'world_gen' as const;
  readonly seed: TextFieldState;
  sizeIndex = 1;
  focus: Field = 'seed';
  world: WorldMap | null = null;
  stage = '';
  stagePct = 0;
  private last: Surface | null = null;

  constructor(
    private readonly host: WorldGenHost,
    private readonly keymap: Keymap,
    private readonly strings: Strings,
    private readonly preview: WorldMapCompositor,
  ) {
    this.seed = { value: host.randomSeed(), focused: true, maxLength: SEED_MAX_LENGTH };
  }

  get size(): number {
    return WORLD_SIZES[this.sizeIndex]?.size ?? WORLD_SIZE_STANDARD;
  }

  setFocus(field: Field): void {
    this.focus = field;
    this.seed.focused = field === 'seed';
  }

  generate(): void {
    const seed = this.seed.value.trim();
    if (seed.length === 0) return;
    this.setFocus('generate');
    this.world = this.host.generate(seed, this.size, (stage, pct) => {
      this.stage = stage;
      this.stagePct = pct;
    });
  }

  draw(surface: Surface): void {
    this.last = surface;
    const s = this.strings;
    const t = surface.theme;
    label(surface, 1, 0, s.get('ui.worldgen.title'), { fg: t.key });
    label(surface, 1, 1, s.get('ui.worldgen.seed'));
    textField(surface, 7, 1, 20, this.seed, () => this.setFocus('seed'));
    button(surface, 32, 1, 'r', s.get('ui.worldgen.random'), () => this.randomize());

    label(surface, 1, 2, s.get('ui.worldgen.size'));
    let c = 7;
    WORLD_SIZES.forEach((opt, index) => {
      const mark = index === this.sizeIndex ? '(•)' : '( )';
      const caption = `${mark} ${s.get(`ui.worldgen.size.${opt.id}`)} ${opt.size}`;
      const n = label(surface, c, 2, caption);
      surface.hit({ col: c, row: 2, cols: n, rows: 1 }, () => {
        this.sizeIndex = index;
        this.setFocus('size');
      });
      c += n + 3;
    });
    if (this.focus === 'size') surface.invert({ col: 1, row: 2, cols: 4, rows: 1 });
    button(surface, 1, 3, 'g', s.get('ui.worldgen.generate'), () => this.generate(), { focused: this.focus === 'generate' });

    // The preview box and the stage line.
    const boxCols = Math.max(10, Math.min(42, surface.cols - 38));
    const boxRows = Math.max(5, Math.min(22, surface.rows - 8));
    this.box(surface, 1, 4, boxCols + 2, boxRows + 2);
    const world = this.world;
    if (world !== null) {
      for (let r = 0; r < boxRows; r += 1) {
        for (let q = 0; q < boxCols; q += 1) {
          const x = Math.floor((q * world.size) / boxCols);
          const y = Math.floor((r * world.size) / boxRows);
          if (surface.inside(2 + q, 5 + r)) surface.cells.setCell(2 + q, 5 + r, this.preview.regionCell(world, y * world.size + x));
        }
      }
    }
    const side = boxCols + 5;
    if (this.stage.length > 0) {
      const caption = s.get('ui.worldgen.stage', { stage: this.stage });
      const n = label(surface, side, 5, caption);
      bar(surface, side + n + 1, 5, this.stagePct, 100, 10);
      label(surface, side + n + 12, 5, `${this.stagePct}%`);
    }
    if (world !== null) {
      const st = worldStats(world);
      label(surface, side, 7, `${s.get('ui.worldgen.land', { pct: st.landPct })}   ${s.get('ui.worldgen.mountains', { pct: st.mountainPct })}`);
      label(surface, side, 8, `${s.get('ui.worldgen.rivers', { n: st.rivers })}    ${s.get('ui.worldgen.volcanoes', { n: st.volcanoes })}`);
    }
    const foot = 4 + boxRows + 2;
    button(surface, 1, foot, 'Enter', s.get('ui.worldgen.continue'), () => this.continue(), { enabled: world !== null });
    button(surface, 36, foot, 'Esc', s.get('ui.worldgen.back'), () => this.host.back());
  }

  private box(surface: Surface, col: number, row: number, cols: number, rows: number): void {
    const t = surface.theme;
    const g = (ch: string): number => surface.glyphs.index(ch);
    for (let c = 0; c < cols; c += 1) {
      surface.put(col + c, row, g(c === 0 ? '┌' : c === cols - 1 ? '┐' : '─'), t.border, t.black);
      surface.put(col + c, row + rows - 1, g(c === 0 ? '└' : c === cols - 1 ? '┘' : '─'), t.border, t.black);
    }
    for (let r = 1; r < rows - 1; r += 1) {
      surface.put(col, row + r, g('│'), t.border, t.black);
      surface.put(col + cols - 1, row + r, g('│'), t.border, t.black);
    }
  }

  randomize(): void {
    this.seed.value = this.host.randomSeed();
    this.world = null;
    this.stage = '';
  }

  continue(): void {
    if (this.world !== null) this.host.continueTo(this.world);
  }

  key(press: KeyPress): boolean {
    if (this.focus === 'seed') {
      if (press.key === 'Enter' || press.key === 'Tab' || press.key === 'Esc') {
        this.setFocus('size');
        return true;
      }
      if (editText(this.seed, press)) {
        this.world = null;
        this.stage = '';
        return true;
      }
    }
    if (press.key === 'Esc') {
      this.host.back();
      return true;
    }
    if (this.focus === 'size' && (press.key === '←' || press.key === '→')) {
      const d = press.key === '←' ? -1 : 1;
      this.sizeIndex = Math.max(0, Math.min(WORLD_SIZES.length - 1, this.sizeIndex + d));
      return true;
    }
    const action = this.keymap.resolve('panel', press);
    if (action === null) return false;
    switch (action.id) {
      case 'select':
      case 'field': {
        const d = action.id === 'field' ? Number(action.arg) : action.arg === '↑' ? -1 : 1;
        const at = FIELDS.indexOf(this.focus);
        this.setFocus(FIELDS[(at + d + FIELDS.length) % FIELDS.length] as Field);
        return true;
      }
      case 'activate':
        if (this.world !== null) this.continue();
        else this.generate();
        return true;
      case 'accelerator':
        if (action.arg === 'g') this.generate();
        else if (action.arg === 'r') this.randomize();
        else return false;
        return true;
      default:
        return false;
    }
  }

  pointerDown(p: CellPointer): void {
    clickHit(this.last, p);
  }
}
