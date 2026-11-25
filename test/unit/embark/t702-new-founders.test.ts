/**
 * T-702: each embark on a world draws its own party and fortress name. The first embark of a world
 * draws from `embark.party` as it always did (the world-hash goldens hold it); after a fortress has
 * ended there, the next draws from `embark.party.<ended>`, and a default name one of the world's
 * fortresses bore is drawn again. And the abandon confirmation says what happens to the saves:
 * a save made before the abandon still loads and plays on.
 */

import { describe, expect, it, vi } from 'vitest';
import { Game } from '@app/game';
import { LegendStore } from '@app/legend';
import { SaveManager } from '@app/save-manager';
import { SettingsStore } from '@app/settings-store';
import { WORLD_SIZE_SMALL } from '@core/constants';
import { RngStream } from '@core/rng';
import { MemoryStorage } from '@platform/storage';
import { EmbarkSession, PARTY_STREAM, defaultFortressName, generateParty } from '@systems/embark';
import { generate, type WorldMap } from '@systems/worldgen';
import { EmbarkScreen } from '@ui/screens/embark';
import { GameMenuScreen } from '@ui/screens/game_menu';
import { WorldMapScreen } from '@ui/screens/world_map';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { press, registry } from '../ui/ui-fixture';

const SEED = 't702-world';

function namesOf(session: EmbarkSession): string[] {
  return session.party.map((d) => d.name);
}

describe('T-702: each embark on a world draws its own party and name', () => {
  it('the first embark of a world draws the world seed\'s party and name from embark.party, as before', () => {
    const rng = RngStream.forStream(SEED, PARTY_STREAM);
    const party = generateParty(rng, registry);
    const name = defaultFortressName(rng, registry);
    for (const session of [new EmbarkSession(registry, SEED, 0), new EmbarkSession(registry, SEED, 0, { ended: 0, names: [] })]) {
      expect(session.party).toEqual(party);
      expect(session.fortressName).toBe(name);
    }
  });

  it('after a fortress has ended on the world, the next embark has another party and a name the world has not had', () => {
    const first = new EmbarkSession(registry, SEED, 0);
    const second = new EmbarkSession(registry, SEED, 0, { ended: 1, names: [first.fortressName] });
    const third = new EmbarkSession(registry, SEED, 0, { ended: 2, names: [first.fortressName, second.fortressName] });
    expect(namesOf(second)).not.toEqual(namesOf(first));
    expect(namesOf(second).filter((n) => namesOf(first).includes(n))).toEqual([]);
    expect(second.fortressName).not.toBe(first.fortressName);
    expect(namesOf(third)).not.toEqual(namesOf(second));
    expect([first.fortressName, second.fortressName]).not.toContain(third.fortressName);
    // Deterministic: the same world and history draw the same party and name.
    const again = new EmbarkSession(registry, SEED, 0, { ended: 1, names: [first.fortressName] });
    expect(again.party).toEqual(second.party);
    expect(again.fortressName).toBe(second.fortressName);
  });

  it('a default name a fortress of the world already bore is drawn again, in any case', () => {
    const plain = new EmbarkSession(registry, SEED, 0, { ended: 1, names: [] });
    const avoided = new EmbarkSession(registry, SEED, 0, { ended: 1, names: [` ${plain.fortressName.toUpperCase()} `] });
    expect(avoided.party).toEqual(plain.party);
    expect(avoided.fortressName).not.toBe(plain.fortressName);
    // Every name taken: the draw ends, with a name.
    const all: string[] = [];
    for (let i = 0; i < 2000; i++) all.push(defaultFortressName(new RngStream(i), registry));
    expect(defaultFortressName(new RngStream(7), registry, all)).toMatch(/\S/);
  });
});

const world: WorldMap = generate(SEED, WORLD_SIZE_SMALL, registry);
const site = world.regions.find((r) => registry.table<{ id: string; embarkable: boolean }>('biomes').byId(r.biome)?.embarkable === true)!;

function embarkScreen(g: Game): EmbarkScreen {
  const top = g.topScreen;
  if (!(top instanceof EmbarkScreen)) throw new Error(`expected the embark screen, got ${g.screen}`);
  return top;
}

async function embark(g: Game): Promise<void> {
  embarkScreen(g).confirm();
  await vi.waitFor(() => expect(g.screen).toBe('fortress'), { timeout: 60_000 });
  await g.settled();
}

describe('T-702: abandon, and a new embark on the same world', () => {
  it('the confirmation says earlier saves still load; one does, and the next embark brings new founders to the old ruin', async () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const g = new Game({
      canvas: new MockCanvas(), seed: 't702', registry, createCanvas: mockCanvasFactory(), devicePixelRatio: 1,
      width: 1280, height: 800, settingsStore: new SettingsStore(storage), saves, legends: new LegendStore(storage),
    });
    await g.showMainMenu();
    g.openWorldMap(world);
    g.openEmbark(world, site.id);
    const firstParty = embarkScreen(g).session.party.map((d) => d.name);
    await embark(g);
    const firstName = g.host.world.fortress.name;
    expect(firstParty).toEqual(new EmbarkSession(registry, world.seed, 0).party.map((d) => d.name));
    g.host.step(5);
    await g.quickSave();
    const quick = (await saves.list()).find((s) => s.header.kind === 'manual');
    expect(quick).toBeDefined();

    g.abandonFortress();
    expect(g.screen).toBe('confirm');
    const text = g.textRows().map((row) => row.trim()).join(' ').replace(/\s+/g, ' ');
    expect(text).toContain(`Abandon ${firstName} and choose a new site on this world? The hall will be recorded in the Legends. Saves made before now can still be loaded.`);
    expect(text).not.toContain('cannot be resumed');
    g.handleKey(press('y'));
    await vi.waitFor(() => expect(g.screen).toBe('world_map'));
    await g.settled();

    // The quick save made before the abandon is still listed, beside the fortress's final save.
    expect((await saves.list()).map((s) => s.id)).toContain(quick!.id);

    // A new embark on the abandoned site: seven new dwarves under a new name, and the log names the old ruin.
    const ruined = (g.topScreen as WorldMapScreen).world;
    g.openEmbark(ruined, site.id);
    const second = embarkScreen(g).session;
    expect(second.party.map((d) => d.name).filter((n) => firstParty.includes(n))).toEqual([]);
    expect(second.fortressName).not.toBe(firstName);
    await embark(g);
    expect(g.host.world.fortress.name).toBe(second.fortressName);
    expect(g.fortress.log.lines.map((line) => line.text)).toContain(`The ruins of ${firstName} lie somewhere on this site.`);

    // The quick save resumes the abandoned fortress, playable and not view-only.
    await g.loadSave(quick!.id);
    await g.settled();
    expect(g.screen).toBe('fortress');
    expect(g.host.world.fortress.name).toBe(firstName);
    expect(g.host.started).toBe(true);
    g.openGameMenu();
    const items = (g.topScreen as GameMenuScreen).items();
    expect(items.find((item) => item.id === 'abandon')?.enabled).toBe(true);
  }, 240_000);
});
