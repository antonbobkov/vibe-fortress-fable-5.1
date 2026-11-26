/**
 * T-771: the Military panel says where a squad's members are and what they are doing
 * (`reports/data/2026-11-25-playtest-6.md`, finding 4; `ui-screens/panels.md` § Military). Under the
 * members' keys a status line counts who stands at the post and what the others do, naming who is
 * down; the armed line counts the conscious members only; the members row wraps instead of cutting.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat';
import { armedLines, drawMilitaryPanel, MilitaryPanel, squadStatus } from '@ui/panels/military';
import type { PanelContext } from '@ui/panels/context';
import type { Surface } from '@ui/surface';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
/** Six names as a playtest's squad had them: the row holds about half of them. */
const SHORT_NAMES = ['Fundin Frostfoot', 'Thora Forgeeye', 'Kari Hold', 'Ulf Dain', 'Yngvar Thorn', 'Sigrun Ash'];
const NAMES = ['Gunnar Coalhammer', 'Ragnhild Brightvein', 'Torvald Deepshield', 'Sigrun Ashbeard', 'Fundin Frostfoot', 'Yngvar Thunderhelm'];

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

/** A squad of `n` dwarves, each holding an iron spear, standing at x = 20, 21, … on row 20. */
function squadOf(n: number, mode: 'off' | 'train' | 'active', seed: string, names: readonly string[] = NAMES) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ctx = ctxOf(w);
  const members = names.slice(0, n).map((name, k) => w.spawnDwarf({ at: w.index(20 + k, 20, z), name, ageYears: 40 }));
  for (const id of members) {
    const spear = w.spawnItem('spear', 'iron', w.index(30, 30, z));
    const items = w.game.world.services.items;
    if (items === null) throw new Error('no item API');
    items.attachToCarrier(spear, id);
    items.setOwner(spear, id);
    const equip = w.game.world.entities.get(id, C.Equipment);
    if (equip === undefined) throw new Error('no equipment');
    equip.weapon = spear;
  }
  ctx.submit({ type: 'CreateSquad', name: 'The Gate Guard' });
  const combat = w.readers.of<CombatReader>('16');
  const squadId = combat.squads()[0]?.id ?? 0;
  ctx.submit({ type: 'SetSquadMembers', squadId, members });
  ctx.submit({ type: 'SetSquadMode', squadId, mode });
  const squad = () => {
    const sq = combat.squad(squadId);
    if (sq === undefined) throw new Error('no squad');
    return sq;
  };
  return { w, ctx, members, squadId, squad, combat };
}

function draw(ctx: PanelContext): Surface {
  const s = surface(36, 60);
  drawMilitaryPanel(s, { col: 0, row: 0, cols: 36, rows: 60 }, new MilitaryPanel(), ctx);
  return s;
}

function rows(s: Surface): string[] {
  return s.lines().map((line) => line.trimEnd().replace(/^ /, ''));
}

/** A wrapped line read whole: the row that starts with `head` and its indented continuation rows. */
function wrapped(lines: readonly string[], head: string): { row: number; text: string; rows: number } {
  const row = lines.findIndex((line) => line.startsWith(head));
  if (row < 0) return { row, text: '', rows: 0 };
  let text = lines[row] as string;
  let k = row + 1;
  for (; k < lines.length && /^ {2}\S/.test(lines[k] as string); k += 1) text += ` ${(lines[k] as string).trim()}`;
  return { row, text, rows: k - row };
}

describe('T-771 the squad says what its members are doing', () => {
  it('two at the station, one walking to it, one eating and one unconscious: the line counts them, names who is down, in the alert colour', () => {
    const { w, ctx, members, squadId, squad, combat } = squadOf(5, 'active', 't771-status');
    // The station is the first member's tile: the posts are it and the tiles around it.
    ctx.submit({ type: 'SetSquadStation', squadId, tile: w.index(20, 20, z) });
    const [atPost, beside, walking, eating, down] = members as [EntityId, EntityId, EntityId, EntityId, EntityId];
    const map = w.readers.map;
    const moveTo = (id: EntityId, x: number, y: number): void => {
      const pos = w.game.world.entities.get(id, C.Position);
      if (pos === undefined) throw new Error('no position');
      w.game.world.entities.add(id, C.Position, { ...pos, x, y });
    };
    // The first two stand on their posts (the point, then the tiles around it, by member id).
    for (const id of [atPost, beside]) {
      const post = combat.postOf(id);
      if (post === null) throw new Error('no post');
      moveTo(id, post % map.w, Math.floor(post / map.w) % map.h);
    }
    // The third stands far off; the fourth eats; the fifth is unconscious.
    moveTo(walking, 45, 40);
    const brain = w.game.world.entities.get(eating, C.Brain);
    if (brain === undefined) throw new Error('no brain');
    brain.behavior = 'need';
    brain.activity = 'hunger';
    const body = w.game.world.entities.get(down, C.Body);
    if (body === undefined) throw new Error('no body');
    body.conscious = false;
    expect([atPost, beside].every((id) => combat.postOf(id) !== null)).toBe(true);

    const status = squadStatus(ctx, squad());
    expect(status).toEqual({ text: 'Now: 2 at post · 1 on the way · 1 eating · 1 down (Fundin F.)', alert: true });
    // The armed line counts the conscious members only.
    expect(armedLines(ctx, squad())?.text).toBe('Armed 4 of 4');

    const s = draw(ctx);
    const lines = rows(s);
    const now = wrapped(lines, 'Now:');
    expect(now.text).toBe('Now: 2 at post · 1 on the way · 1 eating · 1 down (Fundin F.)');
    expect(now.rows).toBeGreaterThan(1);
    expect(fgOfText(s, now.row, 'Now')).toBe(hexOf(theme.alert));
    // It sits under the members' keys, the armed line under it.
    expect(lines[now.row - 1]?.trim()).toBe('[a] add  [r] remove');
    expect(lines[now.row + now.rows]).toBe('Armed 4 of 4');
  });

  it('a squad with no station, no barracks and no order reads "standing … no post"; off duty, "at work"', () => {
    const { ctx, squad } = squadOf(2, 'active', 't771-no-post');
    const status = squadStatus(ctx, squad());
    expect(status).toEqual({ text: 'Now: 2 standing · no post: they stand where they are', alert: false });
    const s = draw(ctx);
    const now = wrapped(rows(s), 'Now:');
    expect(now.text).toBe('Now: 2 standing · no post: they stand where they are');
    expect(fgOfText(s, now.row, 'Now')).toBe(hexOf(theme.text));
    ctx.submit({ type: 'SetSquadMode', squadId: squad().id, mode: 'off' });
    expect(squadStatus(ctx, squad())).toEqual({ text: 'Off duty: at work.', alert: false });
  });

  it("six members' names wrap onto two rows instead of being cut", () => {
    const { ctx } = squadOf(6, 'train', 't771-six', SHORT_NAMES);
    const lines = rows(draw(ctx));
    const members = wrapped(lines, 'Members');
    expect(members.rows).toBe(2);
    expect(lines[members.row + 1]).toMatch(/^ {2}\S/);
    expect(members.text).toBe(`Members ${SHORT_NAMES.map((name) => `${name.split(' ')[0] as string} ${name.split(' ')[1]?.charAt(0) as string}.`).join(', ')}`);
    expect(lines.join('\n')).not.toContain('»');
    expect(lines[members.row + 2]?.trim()).toBe('[a] add  [r] remove');
  });
});
