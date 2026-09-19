import { describe, it, expect } from 'vitest';
import { TileFlag, TileKind } from '@core/map3d';
import { ITEM_BURN_TICKS, BURN_TICK_DAMAGE, PLANT_BURN_TICKS } from '@systems/materials/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test' });
}

function mat(w: TestWorld, id: string): number {
  return w.game.registry.table('materials').index(id);
}

describe('T-M3-04 fire: burnable tiles', () => {
  it('trees, saplings, shrubs, grass floors and peat outdoors; constructed wood anywhere; nothing else', () => {
    const w = world('burnable');
    const fire = w.materials.fire;
    const map = w.map;
    const at = w.index(10, 10, Z);
    const set = (kind: TileKind, material: string, flags: number): void => {
      map.setKind(at, kind, mat(w, material));
      map.flags[at] = flags;
    };
    const outdoor = TileFlag.Outdoor;
    for (const kind of [TileKind.Tree, TileKind.Sapling, TileKind.Shrub]) {
      set(kind, 'oak', outdoor);
      expect(fire.burnableTile(at)).toBe(true);
      // "Cave flora is not burnable": the same plant under a roof.
      set(kind, 'oak', 0);
      expect(fire.burnableTile(at)).toBe(false);
    }
    set(TileKind.Floor, 'loam', outdoor | TileFlag.Grass);
    expect(fire.burnableTile(at)).toBe(true);
    set(TileKind.Floor, 'loam', outdoor);
    expect(fire.burnableTile(at)).toBe(false);
    set(TileKind.Floor, 'peat', outdoor);
    expect(fire.burnableTile(at)).toBe(true);
    set(TileKind.Wall, 'oak', TileFlag.Constructed);
    expect(fire.burnableTile(at)).toBe(true);
    set(TileKind.Floor, 'pine', TileFlag.Constructed);
    expect(fire.burnableTile(at)).toBe(true);
    set(TileKind.Floor, 'granite', TileFlag.Constructed | outdoor);
    expect(fire.burnableTile(at)).toBe(false);
    // Every other kind of plain stone, lit and outdoors or not, is never burnable.
    for (let kind = 0; kind <= TileKind.Boulder; kind += 1) {
      if (kind === TileKind.Tree || kind === TileKind.Sapling || kind === TileKind.Shrub) continue;
      for (const flags of [0, outdoor, outdoor | TileFlag.Lit]) {
        set(kind as TileKind, 'granite', flags);
        expect([kind, flags, fire.burnableTile(at)]).toEqual([kind, flags, false]);
      }
    }
  });

  it('D-097: grass on soil burns for PLANT_BURN_TICKS, a tree for its wood\'s burnTicks', () => {
    const w = world('duration');
    const map = w.map;
    const grass = w.index(10, 10, Z);
    map.setFlag(grass, TileFlag.Grass, true);
    const tree = w.index(12, 10, Z);
    map.setKind(tree, TileKind.Tree, mat(w, 'oak'));
    expect(w.materials.fire.burnTicksOf(grass)).toBe(PLANT_BURN_TICKS);
    expect(w.materials.fire.burnTicksOf(tree)).toBe(600);
  });
});

describe('T-M3-04 fire: burning', () => {
  it('burns out to ash, damages creatures, burns burnable items after ITEM_BURN_TICKS and spares stone', () => {
    const w = world('burning');
    const map = w.map;
    const t = w.index(20, 20, Z);
    map.setFlag(t, TileFlag.Grass, true);
    const log = w.spawnItem('log', 'oak', t);
    const block = w.spawnItem('stone_block', 'granite', t);
    const dwarf = w.spawnDwarf({ at: t });
    w.materials.fire.pendingIgnite.add(t);
    w.step(4);
    expect(map.hasFlag(t, TileFlag.Burning)).toBe(true);
    expect(w.events('FireStarted').map((e) => e['tile'])).toEqual([t]);
    expect(w.pathing.graph.passable(t, 'walker')).toBe(false);
    w.step(ITEM_BURN_TICKS + 10);
    expect(w.game.world.entities.alive(log)).toBe(false);
    expect(w.game.world.entities.alive(block)).toBe(true);
    expect(w.events('BurnDamage').some((e) => e['id'] === dwarf && e['amount'] === BURN_TICK_DAMAGE)).toBe(true);
    w.step(PLANT_BURN_TICKS);
    expect(map.hasFlag(t, TileFlag.Burning)).toBe(false);
    expect(map.hasFlag(t, TileFlag.Ash)).toBe(true);
    expect(map.hasFlag(t, TileFlag.Grass)).toBe(false);
    expect(w.events('FireOut').some((e) => (e['tiles'] as number[]).includes(t))).toBe(true);
  });

  it('water puts a fire out at once, without ash; wet tiles do not catch by spread', () => {
    const w = world('water-out');
    const map = w.map;
    const t = w.index(20, 20, Z);
    const wet = w.index(21, 20, Z);
    for (const i of [t, wet]) map.setFlag(i, TileFlag.Grass, true);
    map.setFlag(wet, TileFlag.Wet, true);
    w.materials.fire.pendingIgnite.add(t);
    w.step(4);
    expect(map.hasFlag(t, TileFlag.Burning)).toBe(true);
    w.step(100);
    expect(map.hasFlag(wet, TileFlag.Burning)).toBe(false);
    w.setFluid(t, 7, 'water', true);
    w.step(12);
    expect(map.hasFlag(t, TileFlag.Burning)).toBe(false);
    expect(map.hasFlag(t, TileFlag.Ash)).toBe(false);
  });

  it('a wooden construction burns away and its loss is a support change: what it held collapses', () => {
    const w = world('construction');
    const base = w.index(30, 30, Z);
    const above = w.index(30, 30, Z + 1);
    const wall = w.build('wall', base, 'oak');
    w.build('floor', above, 'granite');
    expect(w.map.kindAt(base)).toBe(TileKind.Wall);
    expect(w.map.kindAt(above)).toBe(TileKind.Floor);
    w.materials.fire.pendingIgnite.add(base);
    w.step(700);
    expect(w.map.kindAt(base)).toBe(TileKind.Open);
    expect(w.map.hasFlag(base, TileFlag.Constructed)).toBe(false);
    expect(w.game.world.entities.alive(wall)).toBe(false);
    expect(w.map.kindAt(above)).toBe(TileKind.Open);
    expect(w.events('ConstructionCollapsed').some((e) => (e['tiles'] as number[]).includes(above))).toBe(true);
  });
});

describe('T-M3-04 melting and magma safety', () => {
  it('MagmaContact melts a copper bar and leaves a granite block', () => {
    const w = world('melt');
    const t = w.index(20, 20, Z);
    const copper = w.spawnItem('bar', 'copper', t);
    const granite = w.spawnItem('stone_block', 'granite', t);
    w.game.world.emit({ type: 'MagmaContact', tile: t, entities: [copper, granite] });
    w.step(2);
    expect(w.events('ItemMelted').map((e) => e['id'])).toEqual([copper]);
    expect(w.game.world.entities.alive(copper)).toBe(false);
    expect(w.game.world.entities.alive(granite)).toBe(true);
  });

  it('PlaceBuilding next to magma needs a magma-safe material: pine is refused, iron is not', () => {
    const w = world('magma-safe');
    const lava = w.index(40, 40, 25);
    const site = w.index(41, 40, 25);
    const far = w.index(44, 40, 25);
    for (const t of [lava, site, far, w.index(42, 40, 25), w.index(43, 40, 25)]) w.carve(t, TileKind.Floor);
    for (const t of [site, far]) w.discover(t);
    w.map.fluid[lava] = 0x0f; // magma at level 7
    const place = (origin: number, material: string): string => {
      const r = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'floodgate_building', origin, orientation: 0, materialChoice: material });
      return r.ok ? 'ok' : r.reason;
    };
    expect(place(site, 'pine')).toBe('not_magma_safe');
    expect(place(site, '')).toBe('not_magma_safe');
    expect(place(site, 'iron')).toBe('ok');
    expect(place(far, 'pine')).toBe('ok');
  });

  it('14 destroys a building that is not magma-safe when magma touches it, and its item melts', () => {
    const w = world('magma-destroy');
    const lava = w.index(40, 40, 25);
    const site = w.index(41, 40, 25);
    for (const t of [lava, site]) w.carve(t, TileKind.Floor);
    w.discover(site);
    const table = w.build('table', site, 'pine');
    expect(w.game.world.entities.alive(table)).toBe(true);
    w.setFluid(lava, 7, 'magma');
    w.step(40);
    expect(w.game.world.entities.alive(table)).toBe(false);
    expect(w.events('BuildingRemoved').some((e) => e['id'] === table)).toBe(true);
    expect(w.events('ItemDestroyed').some((e) => e['reason'] === 'melted')).toBe(true);
  });
});
