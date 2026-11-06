/**
 * The glyph masks read straight from the bundled TrueType font, with no canvas.
 *
 * The browser builds its atlas from the masks `readGlyphMasks` reads off a canvas (`atlas.ts`): the
 * font drawn at `ATLAS_FONT_SAMPLE` times its design size, centred on its advance and on the middle
 * of its em square, a design pixel on when half its square is covered. A headless picture (the
 * screenshots of `app/screenshot.ts`) needs the same masks where there is no canvas, so this
 * module reads the font's outlines and asks the same question of each design pixel: whether its
 * centre lies inside the outline (non-zero winding). The bundled font draws every glyph on its
 * 8 × 8 design grid, so a pixel is either wholly covered or not at all, and the two readings agree.
 */

import { ATLAS_FONT_DESIGN_PX } from './constants';
import type { GlyphMask } from './atlas';

interface Point { readonly x: number; readonly y: number }

/** The tables of a TrueType font that the outlines need. */
interface Font {
  readonly view: DataView;
  readonly tables: ReadonlyMap<string, number>;
  readonly unitsPerEm: number;
  readonly longLoca: boolean;
}

function readFont(bytes: Uint8Array): Font {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables = new Map<string, number>();
  const count = view.getUint16(4);
  for (let i = 0; i < count; i += 1) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
    tables.set(tag, view.getUint32(at + 8));
  }
  for (const tag of ['cmap', 'head', 'loca', 'glyf']) if (!tables.has(tag)) throw new Error(`font: no ${tag} table`);
  const head = tables.get('head') as number;
  return { view, tables, unitsPerEm: view.getUint16(head + 18), longLoca: view.getInt16(head + 50) === 1 };
}

/** The glyph index of a code point (cmap formats 4 and 12, Unicode encodings), 0 if none. */
export function fontGlyphIndex(font: Font, point: number): number {
  const v = font.view;
  const cmap = font.tables.get('cmap') as number;
  for (let i = 0; i < v.getUint16(cmap + 2); i += 1) {
    const record = cmap + 4 + i * 8;
    const platform = v.getUint16(record);
    const encoding = v.getUint16(record + 2);
    if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
    const start = cmap + v.getUint32(record + 4);
    const format = v.getUint16(start);
    if (format === 12) {
      for (let g = 0; g < v.getUint32(start + 12); g += 1) {
        const at = start + 16 + g * 12;
        const first = v.getUint32(at);
        const last = v.getUint32(at + 4);
        if (point >= first && point <= last) return v.getUint32(at + 8) + point - first;
      }
    } else if (format === 4 && point <= 0xffff) {
      const segments = v.getUint16(start + 6) / 2;
      const ends = start + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const offsets = deltas + segments * 2;
      for (let s = 0; s < segments; s += 1) {
        const first = v.getUint16(starts + s * 2);
        const last = v.getUint16(ends + s * 2);
        if (point < first || point > last) continue;
        const delta = v.getInt16(deltas + s * 2);
        const at = offsets + s * 2;
        const offset = v.getUint16(at);
        if (offset === 0) return (point + delta) & 0xffff;
        const glyph = v.getUint16(at + offset + (point - first) * 2);
        if (glyph !== 0) return (glyph + delta) & 0xffff;
      }
    }
  }
  return 0;
}

/** Where a glyph's outline starts in `glyf`, and its length (0 for an empty glyph). */
function glyphRange(font: Font, glyph: number): { at: number; length: number } {
  const v = font.view;
  const loca = font.tables.get('loca') as number;
  const glyf = font.tables.get('glyf') as number;
  const offset = (g: number): number => (font.longLoca ? v.getUint32(loca + g * 4) : v.getUint16(loca + g * 2) * 2);
  const start = offset(glyph);
  return { at: glyf + start, length: offset(glyph + 1) - start };
}

/** A quadratic segment flattened into this many lines; the bundled font has none. */
const CURVE_STEPS = 4;

/** The closed contours of a glyph as polygons in font units, components placed by their offsets. */
function glyphContours(font: Font, glyph: number, depth = 0): Point[][] {
  const v = font.view;
  const { at, length } = glyphRange(font, glyph);
  if (length === 0 || depth > 8) return [];
  const contours = v.getInt16(at);
  if (contours < 0) return compositeContours(font, at + 10, depth);
  const ends: number[] = [];
  for (let c = 0; c < contours; c += 1) ends.push(v.getUint16(at + 10 + c * 2));
  const points = contours === 0 ? 0 : (ends[contours - 1] as number) + 1;
  let p = at + 10 + contours * 2;
  p += 2 + v.getUint16(p);
  const flags: number[] = [];
  while (flags.length < points) {
    const flag = v.getUint8(p);
    p += 1;
    flags.push(flag);
    if ((flag & 8) !== 0) {
      const repeat = v.getUint8(p);
      p += 1;
      for (let r = 0; r < repeat; r += 1) flags.push(flag);
    }
  }
  const coords = (shortBit: number, sameBit: number): number[] => {
    const out: number[] = [];
    let value = 0;
    for (const flag of flags) {
      if ((flag & shortBit) !== 0) {
        const d = v.getUint8(p);
        p += 1;
        value += (flag & sameBit) !== 0 ? d : -d;
      } else if ((flag & sameBit) === 0) {
        value += v.getInt16(p);
        p += 2;
      }
      out.push(value);
    }
    return out;
  };
  const xs = coords(2, 16);
  const ys = coords(4, 32);
  const out: Point[][] = [];
  let first = 0;
  for (const end of ends) {
    const ring: { x: number; y: number; on: boolean }[] = [];
    for (let k = first; k <= end; k += 1) ring.push({ x: xs[k] as number, y: ys[k] as number, on: ((flags[k] as number) & 1) !== 0 });
    first = end + 1;
    out.push(flatten(ring));
  }
  return out;
}

function compositeContours(font: Font, start: number, depth: number): Point[][] {
  const v = font.view;
  const out: Point[][] = [];
  let p = start;
  for (;;) {
    const flags = v.getUint16(p);
    const glyph = v.getUint16(p + 2);
    p += 4;
    const words = (flags & 1) !== 0;
    const dx = words ? v.getInt16(p) : v.getInt8(p);
    const dy = words ? v.getInt16(p + 2) : v.getInt8(p + 1);
    p += words ? 4 : 2;
    let sx = 1;
    let sy = 1;
    if ((flags & 8) !== 0) { sx = sy = v.getInt16(p) / 16384; p += 2; }
    else if ((flags & 0x40) !== 0) { sx = v.getInt16(p) / 16384; sy = v.getInt16(p + 2) / 16384; p += 4; }
    else if ((flags & 0x80) !== 0) { sx = v.getInt16(p) / 16384; sy = v.getInt16(p + 6) / 16384; p += 8; }
    const offset = (flags & 2) !== 0 ? { x: dx, y: dy } : { x: 0, y: 0 };
    for (const ring of glyphContours(font, glyph, depth + 1)) out.push(ring.map((q) => ({ x: q.x * sx + offset.x, y: q.y * sy + offset.y })));
    if ((flags & 0x20) === 0) break;
  }
  return out;
}

/** A TrueType contour (on- and off-curve points) as a polygon. */
function flatten(ring: readonly { x: number; y: number; on: boolean }[]): Point[] {
  if (ring.length === 0) return [];
  const n = ring.length;
  const at = (k: number): { x: number; y: number; on: boolean } => ring[((k % n) + n) % n] as { x: number; y: number; on: boolean };
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  // Start on an on-curve point (or the midpoint of two off-curve ones).
  let s = ring.findIndex((q) => q.on);
  const startPoint: Point = s >= 0 ? at(s) : mid(at(0), at(1));
  if (s < 0) s = 0;
  const out: Point[] = [startPoint];
  let current = startPoint;
  for (let k = 1; k <= n; k += 1) {
    const q = at(s + k);
    if (q.on) {
      out.push(q);
      current = q;
      continue;
    }
    const next = at(s + k + 1);
    const end = next.on ? next : mid(q, next);
    for (let t = 1; t <= CURVE_STEPS; t += 1) {
      const u = t / CURVE_STEPS;
      out.push({
        x: (1 - u) * (1 - u) * current.x + 2 * (1 - u) * u * q.x + u * u * end.x,
        y: (1 - u) * (1 - u) * current.y + 2 * (1 - u) * u * q.y + u * u * end.y,
      });
    }
    current = end;
    if (next.on) k += 1;
  }
  return out;
}

/** Non-zero winding of the contours around a point. */
function inside(contours: readonly Point[][], x: number, y: number): boolean {
  let winding = 0;
  for (const ring of contours) {
    for (let k = 0; k < ring.length; k += 1) {
      const a = ring[k] as Point;
      const b = ring[(k + 1) % ring.length] as Point;
      if (a.y <= y) {
        if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0) winding += 1;
      } else if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0) winding -= 1;
    }
  }
  return winding !== 0;
}

/**
 * The design bitmaps of `chars` from a TrueType font's bytes: `ATLAS_FONT_DESIGN_PX` rows of as
 * many pixels each, the em square mapped onto the design square (the full block fills it), a
 * pixel on when its centre is inside the glyph. A character the font lacks is empty.
 */
export function fontGlyphMasks(bytes: Uint8Array, chars: readonly string[]): GlyphMask[] {
  const font = readFont(bytes);
  const design = ATLAS_FONT_DESIGN_PX;
  const unit = font.unitsPerEm / design;
  return chars.map((ch) => {
    const mask = new Uint8Array(design * design);
    const glyph = fontGlyphIndex(font, ch.codePointAt(0) ?? 32);
    if (glyph === 0) return mask;
    const contours = glyphContours(font, glyph);
    for (let dy = 0; dy < design; dy += 1) {
      // Design row 0 is the top of the em square; font y grows upwards from its bottom.
      const y = font.unitsPerEm - (dy + 0.5) * unit;
      for (let dx = 0; dx < design; dx += 1) {
        if (inside(contours, (dx + 0.5) * unit, y)) mask[dy * design + dx] = 1;
      }
    }
    return mask;
  });
}
