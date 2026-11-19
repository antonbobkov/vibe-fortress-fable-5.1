/**
 * T-627: Look's `Creatures` tab scrolls, so a wounded dwarf with several thoughts still shows its
 * equipment, relations and title; and the dwarf view has its attributes, personality and
 * productivity after the skills (`ui-screens/fortress-screen.md` § Inspection panel, 24 § Inspection).
 *
 * The fortress: seed `t627-look`, the default embark; its first dwarf is made the Thane, given six
 * skills, wounded twice on three parts and given five thoughts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '@content/loader';
import { Game } from '@app/game';
import { C, type Wound } from '@core/components';
import type { EntityId } from '@core/types';
import type { MoraleReader } from '@systems/morale';
import { drawLookPanel, LookScroll } from '@ui/panels/look';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import type { Surface } from '@ui/surface';
import { press, surface } from './ui-fixture';

let game: Game;
let dwarf: EntityId = 0;
let other: EntityId = 0;

/** Fewer rows than the 1280×800 sidebar's body holds. */
const ROWS = 40;

function tileOf(id: EntityId): number | null {
  const pos = game.host.readers.entities.get(id, C.Position);
  return pos === undefined ? null : game.host.readers.map.index(pos.x, pos.y, pos.z);
}

function drawLook(id: EntityId, view?: LookScroll, rows = ROWS): Surface {
  const s = surface(36, rows);
  const ctx = game.fortress.ctx;
  drawLookPanel(s, { col: 0, row: 0, cols: 36, rows }, ctx.readers, ctx.registry, ctx.strings, tileOf(id), 2, undefined, undefined, undefined, id, view);
  return s;
}

function lines(s: Surface): string[] {
  return s.lines().map((line) => line.trimEnd().replace(/^ /, ''));
}

function wound(): Wound {
  return { type: 'cut', severity: 'light', bleed: 0, pain: 2, healRemaining: 1000, damage: 3, bandaged: true, sutured: false, splinted: false, cleaned: false, dressed: false, infected: false, infectedSince: 0, createdTick: 0 };
}

describe('T-627 the dwarf inspector scrolls, and its attributes, personality and productivity', () => {
  beforeAll(async () => {
    game = new Game({ canvas: new MockCanvas(), seed: 't627-look', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await game.start({ embark: 'default' });
    const list = game.host.readers.of<{ list(): number[] }>('10').list();
    dwarf = list[0] as EntityId;
    other = list[1] as EntityId;
    game.host.submit({ type: 'AssignTitle', dwarfId: dwarf, title: 'thane' });
    game.host.step(1);
    const skills = game.host.world.entities.get(dwarf, C.Skills);
    if (skills === undefined) throw new Error('no skills');
    for (let k = 0; k < 6; k += 1) skills.level[k] = Math.max(skills.level[k] ?? 0, 2);
    const body = game.host.world.entities.get(dwarf, C.Body);
    if (body === undefined) throw new Error('no body');
    for (const part of [0, 1, 4]) body.parts[part]?.wounds.push(wound(), wound());
    body.diagnosed = true;
    const thoughts = game.fortress.ctx.registry.table<{ id: string; value: number; decay: string; hours: number }>('thoughts');
    const picks = thoughts.ids().filter((id) => {
      const def = thoughts.byId(id);
      return def !== undefined && def.decay === 'linear' && def.hours >= 48 && def.value !== 0;
    }).slice(0, 5);
    const mood = game.host.world.entities.get(dwarf, C.Mood);
    if (mood === undefined) throw new Error('no mood');
    const tick = game.host.readers.calendar.tick;
    mood.thoughts = [...mood.thoughts, ...picks.map((id) => ({ thought: thoughts.index(id), startTick: tick, baseValue: thoughts.byId(id)?.value ?? 0 }))];
    expect(game.host.readers.of<MoraleReader>('15').thoughts(dwarf).length).toBeGreaterThanOrEqual(5);
  });

  it('after the skills: the attributes, the three traits by name and the productivity', () => {
    const shown = lines(drawLook(dwarf, undefined, 120));
    const attributes = game.host.readers.entities.get(dwarf, C.Attributes);
    if (attributes === undefined) throw new Error('no attributes');
    const { str, agi, tou, end, wil, wit, cha } = attributes;
    const round = Math.round;
    // Five to a row in the 34 cells of the sidebar, the other two under them.
    const first = shown.findIndex((line) => line.startsWith('Str '));
    expect(shown[first]).toBe(`Str ${round(str)} Agi ${round(agi)} Tou ${round(tou)} End ${round(end)} Wil ${round(wil)}`);
    expect(shown[first + 1]).toBe(`Wit ${round(wit)} Cha ${round(cha)}`);
    const traits = game.host.readers.entities.get(dwarf, C.Personality)?.traits ?? [];
    const table = game.fortress.ctx.registry.table<{ id: string; name: string }>('personality');
    const names = traits.map((trait) => table.byIndex(trait)?.name ?? '');
    expect(names.length).toBe(3);
    expect(names.every((name) => name !== '')).toBe(true);
    expect(shown[first + 2]).toBe(`Personality ${names.join(', ')}`);
    const productivity = game.host.readers.of<{ productivity(id: number): number }>('10').productivity(dwarf);
    expect(shown[first + 3]).toBe(`Productivity ${productivity}%`);
    const at = (head: string): number => shown.findIndex((line) => line.startsWith(head));
    const order = ['Skills', 'Str ', 'Personality', 'Productivity', 'Mood', 'Health', 'Equipment', 'Title'].map(at);
    expect(order.every((row) => row >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it('a wounded dwarf with several thoughts: its Title is reached by scrolling, and the marks say what lies past the edges', () => {
    const view = new LookScroll();
    let s = drawLook(dwarf, view);
    let shown = lines(s);
    expect(shown.some((line) => line.startsWith('Title'))).toBe(false);
    // More below: a dim ▼ at the right edge of the last row, nothing above.
    expect(s.lines()[ROWS - 1]?.charAt(35)).toBe('▼');
    expect(s.lines()[2]?.charAt(35)).not.toBe('▲');
    expect(view.max).toBeGreaterThan(0);
    for (let k = 0; k < 10 && !shown.some((line) => line.startsWith('Title')); k += 1) {
      view.page(1);
      s = drawLook(dwarf, view);
      shown = lines(s);
    }
    expect(shown).toContain('Title Thane');
    expect(shown.some((line) => line.startsWith('Equipment'))).toBe(true);
    expect(shown.some((line) => line.startsWith('Relations'))).toBe(true);
    // The header and the tabs line stay; the tab's first rows scrolled away under them, marked ▲.
    expect(shown[0]).toMatch(/^Look · /);
    expect(s.lines()[2]?.charAt(35)).toBe('▲');
    expect(view.scroll).toBe(view.max);
    expect(s.lines()[ROWS - 1]?.charAt(35)).not.toBe('▼');
    // Past the end it stays at the end.
    view.page(1);
    expect(view.scroll).toBe(view.max);
    // Another creature first starts the tab at the top.
    drawLook(other, view);
    expect(view.scroll).toBe(0);
  });

  it('in the fortress, PageDown and the wheel scroll the Creatures tab; inspecting again or another tab starts it at the top', () => {
    const fortress = game.fortress;
    const pos = game.host.readers.entities.get(dwarf, C.Position);
    if (pos === undefined) throw new Error('no position');
    fortress.look({ x: pos.x, y: pos.y, z: pos.z }, 2, dwarf);
    game.render();
    expect(fortress.lookView.scroll).toBe(0);
    expect(fortress.lookView.max).toBeGreaterThan(3);
    expect(game.handleKey(press('PageDown'))).toBe(true);
    game.render();
    const page = fortress.lookView.visible - 1;
    expect(fortress.lookView.scroll).toBe(Math.min(page, fortress.lookView.max));
    game.handleKey(press('PageUp'));
    game.render();
    expect(fortress.lookView.scroll).toBe(0);
    // The wheel over the sidebar: three rows a notch, and the level stays.
    const z = fortress.ui.z;
    fortress.wheel({ col: 70, row: 10, dy: 1, shift: false, ctrl: false, alt: false, meta: false });
    game.render();
    expect(fortress.lookView.scroll).toBe(3);
    expect(fortress.ui.z).toBe(z);
    const s = game.uiSurface;
    if (s === null) throw new Error('no surface');
    expect(s.lines().some((line) => line.trimEnd().endsWith('▲'))).toBe(true);
    // Another tab and back: the top again.
    game.handleKey(press('1'));
    game.render();
    game.handleKey(press('3'));
    game.render();
    expect(fortress.lookView.scroll).toBe(0);
    fortress.wheel({ col: 70, row: 10, dy: 1, shift: false, ctrl: false, alt: false, meta: false });
    game.render();
    expect(fortress.lookView.scroll).toBe(3);
    fortress.look({ x: pos.x, y: pos.y, z: pos.z }, 2, dwarf);
    game.render();
    expect(fortress.lookView.scroll).toBe(0);
  });
});
