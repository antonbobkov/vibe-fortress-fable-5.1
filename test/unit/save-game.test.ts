/**
 * T-M2-11 save and load: the id-field table, the entity section, the container round trip, the
 * autosave rotation, header listing without inflating, import of an exported file, the Load
 * screen, the confirmation dialog, and `F5` / `F9` through the app.
 */

import { describe, it, expect } from 'vitest';
import { loadContent } from '@content/loader';
import { C } from '@core/components';
import { ID_FIELDS, idsToStrings, referencedIds, stringsToIds } from '@core/id-fields';
import { HeadlessGame } from '@app/headless';
import { gameSections, loadGame, roundTrip, saveGame, validateImport, SaveLoadError, type EntityStoreState } from '@app/game-save';
import {
  SaveManager,
  jsonSection,
  newestManualId,
  readJsonSection,
  readSave,
  rollAutosaves,
  writeSave,
  type SaveHeader,
} from '@app/save-manager';
import { MemoryStorage } from '@platform/storage';
import { Game, listingOf } from '@app/game';
import { LoadScreen } from '@ui/screens/load';
import { ConfirmScreen } from '@ui/screens/confirm';
import { Keymap, type KeymapRow } from '@ui/keymap';
import { Strings } from '@ui/strings';
// @ts-expect-error -- a plain .mjs script without type declarations
import { parseIdFields } from '../../scripts/parse-id-fields.mjs';
import { MockCanvas, mockCanvasFactory } from './render/canvas-mock';
import { press, surface } from './ui/ui-fixture';

const registry = loadContent();

function header(id: number, kind: SaveHeader['kind'], tick: number): Omit<SaveHeader, 'formatVersion' | 'compressed'> {
  return {
    gameVersion: '0.2.0',
    seed: `s${id}`,
    fortress: 'Emberhall',
    calendar: { tick, year: 1, season: 0, day: 1 },
    contentHash: registry.contentHash,
    population: 7,
    wealth: 1234,
    playTimeSeconds: 0,
    kind,
  };
}

describe('T-M2-11 save: the id-field table', () => {
  it('is the table scripts/parse-id-fields.mjs generates from components.md, over tables that exist', () => {
    expect(ID_FIELDS.map((f) => ({ ...f }))).toEqual(parseIdFields() as unknown);
    for (const f of ID_FIELDS) expect(registry.hasTable(f.table), f.table).toBe(true);
  });

  it('writes content indices as string ids and reads them back', () => {
    const items = registry.table('items');
    const materials = registry.table('materials');
    const item = { type: items.index('log'), material: materials.index('pine'), count: 3 };
    const saved = idsToStrings('Item', item, registry) as Record<string, unknown>;
    expect(saved).toMatchObject({ type: 'log', material: 'pine', count: 3 });
    expect(item.type).toBe(items.index('log'));
    expect(stringsToIds('Item', saved, registry)).toEqual(item);
    const traits = registry.table('personality').ids().slice(0, 3);
    const p = { traits: traits.map((t) => registry.table('personality').index(t)) };
    expect(idsToStrings('Personality', p, registry)).toEqual({ traits });
    expect(idsToStrings('Skills', { lastRaised: 0 }, registry)).toEqual({ lastRaised: null });
    expect(stringsToIds('Skills', { lastRaised: null }, registry)).toEqual({ lastRaised: 0 });
    const order = { orders: [{ recipe: registry.table('recipes').index(registry.table('recipes').ids()[0] as string), materialFilter: 'metal' }] };
    const back = stringsToIds('Workshop', idsToStrings('Workshop', order, registry), registry);
    expect(back).toEqual(order);
  });

  it('collects the referenced ids of the entity section for the soft match', () => {
    const ids = referencedIds({ Item: [[1, { type: 'log', material: 'pine' }]], Zone: [[2, { type: 'stockpile' }]], Brain: [[3, { activity: 'x' }]] });
    expect(ids).toEqual(['log', 'pine', 'stockpile']);
  });
});

describe('T-M2-11 save: sections and the container', () => {
  it('writes the sections in the documented order and converts ids in the entity section', () => {
    const game = new HeadlessGame({ seed: 'save-sections', world: 'flat-test', embark: 'default' });
    game.step(30);
    const sections = gameSections(game);
    const names = sections.map((s) => s.name.split(':')[0]);
    expect(names.slice(0, 11)).toEqual(['world', 'map.kind', 'map.material', 'map.fluid', 'map.designation', 'map.flags', 'map.tempOverride', 'map.buildingAt', 'map.chunkFluidCounts', 'entities', 'fortress']);
    const entities = readJsonSection(sections.find((s) => s.name === 'entities') as never) as EntityStoreState;
    const item = entities.components['Item']?.[0]?.[1] as { type: unknown };
    expect(typeof item.type).toBe('string');
    expect(entities.slots.length).toBe(game.world.entities.slotCount);
    const systems = readJsonSection(sections.find((s) => s.name === 'systems') as never) as Record<string, unknown>;
    expect(Object.keys(systems).sort()).toEqual(['03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '24', '25']);
  });

  it('saves through the compressed container and loads to the same hash, paused and continuing identically', async () => {
    const a = new HeadlessGame({ seed: 'save-container', world: 'flat-test', embark: 'default' });
    a.step(120);
    const blob = await saveGame(a, { kind: 'manual' });
    const save = await readSave(blob);
    expect(save.header.kind).toBe('manual');
    expect(save.header.population).toBe(7);
    const loaded = await loadGame(blob);
    expect(loaded.content.match).toBe('exact');
    const b = loaded.game;
    expect(b.tick).toBe(a.tick);
    expect(b.hash()).toBe(a.hash());
    a.step(300);
    b.step(300);
    expect(b.hash()).toBe(a.hash());
  });

  it('keeps the destroyed slots and the free list, so new ids match after a load', () => {
    const a = new HeadlessGame({ seed: 'save-slots', world: 'flat-test', embark: 'default' });
    const items = a.world.entities.with(C.Item);
    a.world.services.items?.destroy(items[0] as number, 'test');
    a.world.services.items?.destroy(items[1] as number, 'test');
    const b = roundTrip(a).game;
    expect(b.world.entities.create('item')).toBe(a.world.entities.create('item'));
    expect(b.world.entities.create('item')).toBe(a.world.entities.create('item'));
  });
});

describe('T-M2-11 save store', () => {
  it('the autosave rotation keeps the four newest autosaves and never a manual save', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const empty = [jsonSection('world', {})];
    await saves.write('manual-1', await writeSave(header(1, 'manual', 1), empty));
    for (let k = 0; k < 6; k += 1) {
      await saves.write(`auto-1-${k}`, await writeSave(header(k, 'auto', 1000 * (k + 1)), empty));
      await rollAutosaves(saves);
    }
    const ids = (await saves.list()).map((s) => s.id).sort();
    expect(ids).toEqual(['auto-1-2', 'auto-1-3', 'auto-1-4', 'auto-1-5', 'manual-1']);
  });

  it('lists headers without inflating a body: a save with a corrupt body is still listed', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const blob = await writeSave(header(1, 'manual', 5), [jsonSection('world', {})]);
    const corrupt = blob.slice();
    corrupt.fill(0xff, corrupt.length - 8);
    await saves.write('manual-5', corrupt);
    const rows = await saves.list();
    expect(rows.map((r) => r.header.calendar.tick)).toEqual([5]);
    await expect(readSave((await saves.read('manual-5')) as Uint8Array)).rejects.toBeDefined();
  });

  it('the quick save is the newest manual-<unixMs> save', async () => {
    const saves = new SaveManager(new MemoryStorage());
    expect(await newestManualId(saves)).toBeNull();
    const blob = await writeSave(header(1, 'manual', 5), [jsonSection('world', {})]);
    await saves.write('manual-100', blob);
    await saves.write('manual-2000', blob);
    await saves.write('auto-1-0', await writeSave(header(1, 'auto', 9), [jsonSection('world', {})]));
    expect(await newestManualId(saves)).toBe('manual-2000');
  });

  it('an exported file, imported, loads to the original hash; a save naming missing content is refused', async () => {
    const a = new HeadlessGame({ seed: 'save-import', world: 'flat-test', embark: 'default' });
    a.step(40);
    const exported = await saveGame(a, { kind: 'manual' });
    const game = new Game({
      canvas: new MockCanvas(),
      seed: 'save-import',
      registry,
      createCanvas: mockCanvasFactory(),
      width: 1280,
      height: 800,
      saves: new SaveManager(new MemoryStorage()),
    });
    const id = await game.importBlob(exported);
    expect(id).toMatch(/^manual-\d+$/);
    await game.loadSave(id);
    expect(game.host.headless.hash()).toBe(a.hash());
    expect(game.screen).toBe('fortress');

    // A different content hash and an item type the tables do not have: the soft match fails.
    const save = await readSave(exported);
    const sections = save.sections.map((s) => {
      if (s.name !== 'entities') return s;
      const e = readJsonSection(s) as EntityStoreState;
      const rows = e.components['Item'] as [number, Record<string, unknown>][];
      (rows[0] as [number, Record<string, unknown>])[1]['type'] = 'no_such_item';
      return jsonSection('entities', e);
    });
    const bad = await writeSave({ ...save.header, contentHash: 'sha256-other' }, sections);
    await expect(validateImport(bad, registry)).rejects.toBeInstanceOf(SaveLoadError);
    await expect(validateImport(bad, registry)).rejects.toThrow(/no_such_item/);
    // The same file with the content present passes the soft match.
    const soft = await writeSave({ ...save.header, contentHash: 'sha256-other' }, save.sections);
    expect((await loadGame(soft)).content.match).toBe('soft');
  });
});

describe('T-M2-11 Load screen and confirmation', () => {
  const keymap = Keymap.fromRows(registry.derived<readonly KeymapRow[]>('keymap'));
  const strings = new Strings(registry);

  it('groups manual saves and autosaves, newest first, and loads, deletes and exports the selection', () => {
    const calls: string[] = [];
    const listing = [
      listingOf('auto-1-0', { ...header(1, 'auto', 1200), formatVersion: 1, compressed: true }),
      listingOf('manual-1', { ...header(1, 'manual', 500), formatVersion: 1, compressed: true }),
      listingOf('manual-2', { ...header(2, 'manual', 900), formatVersion: 1, compressed: true }),
    ];
    const screen = new LoadScreen(
      {
        saves: () => listing,
        load: (id) => calls.push(`load ${id}`),
        remove: (id) => calls.push(`remove ${id}`),
        exportSave: (id) => calls.push(`export ${id}`),
        importSave: () => calls.push('import'),
        back: () => calls.push('back'),
      },
      keymap,
      strings,
    );
    const s = surface(100, 40);
    screen.draw(s);
    const text = s.lines().join('\n');
    expect(text).toContain('Manual');
    expect(text).toContain('Autosaves');
    expect(text.indexOf('Day 1 of Spring, Year 1 · 7 dwarves · 1,234 ☼')).toBeGreaterThan(0);
    expect(text).toContain('Spring, Year 1 (auto)');
    expect(screen.ordered().map((l) => l.id)).toEqual(['manual-2', 'manual-1', 'auto-1-0']);
    screen.key(press('↓'));
    screen.key(press('Enter'));
    screen.key(press('x'));
    screen.key(press('e'));
    screen.key(press('i'));
    screen.key(press('Esc'));
    expect(calls).toEqual(['load manual-1', 'remove manual-1', 'export manual-1', 'import', 'back']);
  });

  it('the confirmation takes y, n and Enter for the safe default', () => {
    const answers: boolean[] = [];
    const dialog = new ConfirmScreen(registry, strings, 'c_quickload', {}, (yes) => answers.push(yes));
    expect(dialog.text).toBe('Load the quick save? Unsaved progress will be lost.');
    expect(dialog.defaultYes).toBe(false);
    dialog.key(press('Enter'));
    dialog.key(press('y'));
    dialog.key(press('n'));
    expect(answers).toEqual([false, true, false]);
    const del = new ConfirmScreen(registry, strings, 'c_delete_save', { save: 'Emberhall' }, () => {});
    expect(del.text).toBe('Delete Emberhall? This cannot be undone.');
  });
});

describe('T-M2-11 app: F5, F9, autosave, Continue', () => {
  function newGame(saves: SaveManager): Game {
    return new Game({
      canvas: new MockCanvas(),
      seed: 'save-app',
      registry,
      createCanvas: mockCanvasFactory(),
      width: 1280,
      height: 800,
      saves,
    });
  }

  it('F5 saves, F9 asks and restores the saved hash; Continue loads the newest save', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const game = newGame(saves);
    await game.start({ embark: 'default' });
    game.host.step(25);
    const hash = game.host.headless.hash();
    game.handleKey({ key: 'F5', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    await game.settled();
    expect(game.lastSaveId).toMatch(/^manual-\d+$/);
    game.host.step(50);
    expect(game.host.headless.hash()).not.toBe(hash);
    game.handleKey({ key: 'F9', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    await game.settled();
    expect(game.screen).toBe('confirm');
    game.handleKey({ key: 'y', repeat: false, shift: false, ctrl: false, alt: false, meta: false });
    await game.settled();
    expect(game.screen).toBe('fortress');
    expect(game.host.headless.hash()).toBe(hash);
    expect(game.host.speed()).toBe(0);

    const other = newGame(saves);
    await other.showMainMenu();
    expect(other.textRows().join('\n')).toContain('Continue');
    await other.continueNewest();
    expect(other.host.headless.hash()).toBe(hash);
  });

  it('SeasonChanged autosaves as auto-<year>-<season> after the tick that announced it', async () => {
    const saves = new SaveManager(new MemoryStorage());
    const game = newGame(saves);
    await game.start({ embark: 'default' });
    const calendar = game.host.readers.calendar;
    const seasonNow = calendar.season;
    let guard = 0;
    while (game.host.readers.calendar.season === seasonNow && guard < 200_000) {
      game.host.step(100);
      guard += 100;
    }
    game.host.step(2);
    await game.settled();
    const ids = (await saves.list()).map((s) => s.id);
    const year = game.host.readers.calendar.year;
    const season = game.host.readers.calendar.season;
    expect(ids).toContain(`auto-${year}-${season}`);
    const loaded = await loadGame((await saves.read(`auto-${year}-${season}`)) as Uint8Array);
    expect(loaded.header.kind).toBe('auto');
    expect(loaded.header.thumbnail?.cols).toBe(48);
    expect(loaded.header.thumbnail?.rows).toBe(27);
  }, 120_000);
});
