/** T-248: reuse recipe grouping and choose squad gear before sending a command. */
import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import type { BuildingsSystem } from '@systems/buildings';
import type { WorkshopsReader } from '@systems/workshops';
import { drawWorkshopPanel } from '@ui/panels/orders';
import { drawMilitaryPanel } from '@ui/panels/military';
import { clickHit } from '@ui/screen';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, registry, surface } from './ui-fixture';
async function game() {
  const g = new Game({ canvas: new MockCanvas(), registry, seed: 't248-pickers', createCanvas: mockCanvasFactory(), width: 1280, height: 800, devicePixelRatio: 1 });
  await g.start(); return g;
}
async function workshop() {
  const g = await game(), map = g.host.world.map;
  g.host.submit({ type: 'PlaceBuilding', buildingType: 'carpenter', origin: map.index(40, 20, g.ui.z), orientation: 0, materialChoice: 'pine' }); g.host.step(1);
  const system = g.host.world.scheduler.byId('14') as BuildingsSystem, id = system.lastPlacedBuilding;
  expect(id).toBeGreaterThan(0); system.completeNow(id, registry.table('materials').index('pine'), 0); g.host.step(1);
  return { g, id };
}
async function squad() {
  const g = await game(); g.host.submit({ type: 'CreateSquad', name: 'T248' }); g.host.step(1); g.fortress.openPanel('military'); return g;
}
const pointer = (col: number, row: number) => ({ col, row, button: 0, shift: false, ctrl: false, alt: false, meta: false });

describe('T-248 grouped recipes and single-choice gear', () => {
  it('uses the picker category headings and their order in the workshop list', async () => {
    const { g, id } = await workshop(), panel = g.fortress.orders;
    panel.openPicker(g.fortress.ctx, { workshopId: id });
    const headings = panel.pickerRows(g.fortress.ctx).flatMap(row => 'heading' in row ? [row.heading] : []);
    expect(headings.length).toBeGreaterThan(1); panel.picker.open = false;
    const s = surface(36, 60); drawWorkshopPanel(s, { col: 0, row: 0, cols: 36, rows: 60 }, id, panel, g.fortress.ctx);
    const text = s.lines().filter(line => line.includes('──')).join('\n'); let previous = -1;
    for (const heading of headings) { const index = text.indexOf(heading); expect(index).toBeGreaterThan(previous); previous = index; }
  });
  it('a recipe click still opens Add order on exactly that recipe', async () => {
    const { g, id } = await workshop(), panel = g.fortress.orders;
    const building = g.host.readers.of<import('@systems/buildings').BuildingsReader>('14').get(id)!;
    const recipe = g.host.readers.of<WorkshopsReader>('12').recipesFor(building.typeId).find(r => r.outputs.some(o => o.item === 'bed'))!;
    const s = surface(36, 60); drawWorkshopPanel(s, { col: 0, row: 0, cols: 36, rows: 60 }, id, panel, g.fortress.ctx, (_action, recipeId) => panel.openPicker(g.fortress.ctx, { workshopId: id, ...(recipeId === undefined ? {} : { recipeId }) }));
    const row = s.lines().findIndex(line => line.includes(recipe.name)); expect(row).toBeGreaterThan(0); clickHit(s, pointer(2, row));
    expect(panel.picker.open).toBe(true); expect(panel.pickerRecipe(g.fortress.ctx)?.id).toBe(recipe.id);
  });
  it.each([['w', 'weapon'], ['g', 'armor']])('%s opens %s without cycling the equipment', async (key, kind) => {
    const g = await squad(), spy = vi.spyOn(g.host, 'submit'); const before = { ...g.fortress.military.selectedSquad(g.fortress.ctx)!.equipment };
    expect(g.fortress.key(press(key))).toBe(true); expect(g.fortress.military.memberChoice?.kind).toBe(kind);
    expect(spy).not.toHaveBeenCalled(); expect(g.fortress.military.selectedSquad(g.fortress.ctx)!.equipment).toEqual(before);
    g.fortress.key(press('Esc')); expect(g.fortress.military.memberChoice).toBeNull(); expect(spy).not.toHaveBeenCalled();
  });
  it('lists every accepted weapon class and marks the current value', async () => {
    const g = await squad(); g.fortress.key(press('w'));
    const s = surface(36, 45); drawMilitaryPanel(s, { col: 0, row: 0, cols: 36, rows: 45 }, g.fortress.military, g.fortress.ctx);
    const text = s.lines().join('\n'); expect(text).toContain('any (current)');
    // A channel's class (25) is not a squad preference and is not offered.
    for (const value of new Set(registry.table<{ id: string; weaponClass?: string; launcher?: { ammo?: string } }>('weapons').rows
      .flatMap(r => r.weaponClass === undefined || (r.launcher !== undefined && r.launcher.ammo === undefined) ? [] : [r.weaponClass]))) expect(text).toContain(value);
  });
  it('Enter commits the selected armor; a mouse row commits the selected weapon', async () => {
    const g = await squad(), spy = vi.spyOn(g.host, 'submit'); g.fortress.key(press('g')); g.fortress.key(press('ArrowDown')); g.fortress.key(press('Enter'));
    expect(spy.mock.lastCall?.[0]).toMatchObject({ type: 'SetSquadEquipment', equipment: { armor: 'metal', weaponClass: 'any' } });
    g.fortress.key(press('w')); const s = surface(36, 45); drawMilitaryPanel(s, { col: 0, row: 0, cols: 36, rows: 45 }, g.fortress.military, g.fortress.ctx);
    const row = s.lines().findIndex(line => line.trim() === 'axe'); expect(row).toBeGreaterThan(0); clickHit(s, pointer(2, row));
    expect(spy.mock.lastCall?.[0]).toMatchObject({ type: 'SetSquadEquipment', equipment: { armor: 'metal', weaponClass: 'axe' } }); expect(g.fortress.military.memberChoice).toBeNull();
  });
  it('browses workshop recipes beyond a short sidebar by keyboard and scrollbar', async () => {
    const { g, id } = await workshop(), panel = g.fortress.orders;
    g.fortress.workshopId = id; g.fortress.openPanel('workshop');
    const building = g.host.readers.of<import('@systems/buildings').BuildingsReader>('14').get(id)!;
    const recipes = panel.groupRecipes(g.fortress.ctx, g.host.readers.of<WorkshopsReader>('12').recipesFor(building.typeId)).flatMap(row => 'recipe' in row ? [row.recipe] : []);
    for (let n = 0; n < recipes.length - 1; n += 1) g.fortress.key(press('ArrowDown'));
    const s = surface(36, 26); drawWorkshopPanel(s, { col: 0, row: 0, cols: 36, rows: 26 }, id, panel, g.fortress.ctx);
    expect(s.lines().join('\n')).toContain(recipes.at(-1)!.name); g.fortress.key(press('Enter'));
    expect(panel.pickerRecipe(g.fortress.ctx)?.id).toBe(recipes.at(-1)!.id);
    panel.picker.open = false; panel.workshopList(id).selected = 0;
    const mouse = surface(36, 26); drawWorkshopPanel(mouse, { col: 0, row: 0, cols: 36, rows: 26 }, id, panel, g.fortress.ctx);
    expect(clickHit(mouse, pointer(34, 16))).toBe(true); expect(panel.workshopList(id).selected).toBe(recipes.length - 1);
    expect(panel.picker.open).toBe(false);
  });
  it('mouse dropdowns list all armor choices, cancel without submitting, and retain the current cursor', async () => {
    const g = await squad(), spy = vi.spyOn(g.host, 'submit');
    const draw = () => { const s = surface(36, 45); drawMilitaryPanel(s, { col: 0, row: 0, cols: 36, rows: 45 }, g.fortress.military, g.fortress.ctx); return s; };
    let s = draw(); const armorRow = s.lines().findIndex(line => line.includes('[g] armor'));
    expect(clickHit(s, pointer(3, armorRow))).toBe(true); s = draw();
    for (const value of ['any (current)', 'metal', 'leather']) expect(s.lines().join('\n')).toContain(value);
    clickHit(s, pointer(18, 44)); expect(g.fortress.military.memberChoice).toBeNull(); expect(spy).not.toHaveBeenCalled();
    g.fortress.key(press('w')); g.fortress.key(press('ArrowDown')); g.fortress.key(press('Enter'));
    const selected = g.fortress.military.selectedSquad(g.fortress.ctx)!.equipment.weaponClass;
    s = draw(); clickHit(s, pointer(8, s.lines().findIndex(line => line.includes('[w] weapon'))));
    expect(g.fortress.military.memberChoice?.selected).toBe(g.fortress.military.gearOptions(g.fortress.ctx, 'weapon').indexOf(selected));
    expect(draw().lines().join('\n')).toContain(`${selected} (current)`);
  });

});
