/**
 * T-635: the small fixes of the mid-game audit (`reports/audits/2026-11-19-t635-midgame-ux.md`):
 * combat and job lines name a creature by its species rather than its content id, the raid
 * warning says its edge once, a raid's arrival says who came and from where while a thief's is
 * not announced, a kill order on a shared tile takes the raider before the fortress's dog, the
 * reputation log gives its reasons in words, a wave with one child says "a child", and the legend
 * names its biome and counts one enemy.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { composeLegend } from '@app/legend';
import type { Command } from '@core/commands';
import type { GameEvent } from '@core/events';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog } from '@ui/announcements';
import { reputationEntryText } from '@ui/panels/civilizations';
import type { PanelContext } from '@ui/panels/context';
import { creatureTargetName, jobTypeName } from '@ui/panels/jobs';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { legendLines } from '@ui/screens/legend';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const sent: Command[] = [];
  const ui = defaultUiState(z);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui, submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
    speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
  };
  const screen = new FortressScreen(host, keymap, strings);
  ui.camX = 20;
  ui.camY = 20;
  return { w, screen, sent };
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

describe('T-635 a creature in a line is named by its species, never its content id', () => {
  it('a blow between a dwarf and a raider names the raider "a hillfolk bandit" and the dwarf by its first name', () => {
    const { w } = setup('t635-blow');
    const log = announcer(w);
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, z), name: 'Halvar Ironfell' });
    const bandit = w.spawnCreature('hillfolk_bandit', w.index(11, 10, z), 'hostile:hillfolk');
    const hit = { type: 'AttackResolved', attackerId: bandit, defenderId: dwarf, part: 'torso', damageType: 'blunt', amount: 3, outcome: 'hit' } as unknown as GameEvent;
    expect(log.announce(hit, w.readers, 1)?.line.text).toBe('A hillfolk bandit hits Halvar: 3 blunt.');
    const back = { type: 'AttackResolved', attackerId: dwarf, defenderId: bandit, part: 'torso', damageType: 'edge', amount: 5, outcome: 'hit' } as unknown as GameEvent;
    expect(log.announce(back, w.readers, 2)?.line.text).toBe('Halvar hits a hillfolk bandit: 5 edge.');
  });

  it('a creature gone before its line is drawn is "a creature", not "defender"', () => {
    const { w } = setup('t635-gone');
    const log = announcer(w);
    const archer = w.spawnCreature('gloam_archer', w.index(11, 10, z), 'hostile:gloam');
    const hit = { type: 'AttackResolved', attackerId: archer, defenderId: 987654, part: 'torso', damageType: 'pierce', amount: 13, outcome: 'hit' } as unknown as GameEvent;
    expect(log.announce(hit, w.readers, 1)?.line.text).toBe('A gloam archer hits a creature: 13 pierce.');
  });

  it('the Jobs panel capitalises a job without a string of its own and names a hunted animal by its species', () => {
    const { w } = setup('t635-jobs');
    const ctx = ctxOf(w);
    expect(jobTypeName(ctx, 'plant')).toBe('Plant');
    expect(jobTypeName(ctx, 'carry_patient')).toBe('Carry patient');
    expect(jobTypeName(ctx, 'haul_to_stockpile')).toBe('Haul');
    const horse = w.spawnCreature('wild_horse', w.index(30, 30, z), 'wild');
    expect(creatureTargetName(ctx, horse)).toBe('wild horse');
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, z), name: 'Liv Hammerfall' });
    expect(creatureTargetName(ctx, dwarf)).toBe('Liv Hammerfall');
  });
});

describe('T-635 a raid says where it comes from, once', () => {
  it('the warning names its edge without doubling it', () => {
    const { w } = setup('t635-warning');
    const log = announcer(w);
    const warning = { type: 'ThreatWarning', kind: 'raid', civ: 'gloam', sizeBand: 'band', edge: 'n' } as unknown as GameEvent;
    expect(log.announce(warning, w.readers, 1)?.line.text).toBe('Gloam scouts have been seen at the northern edge. They will come tomorrow.');
  });

  it('a raid, a siege and bandits name their edge; a thief comes unannounced', () => {
    const { w } = setup('t635-arrival');
    // Under Hearth: a Calm fortress's line adds what the alert does (T-734).
    w.submit({ type: 'SetAlert', level: 'hearth' });
    w.step(1);
    const log = announcer(w);
    const arrived = (kind: string, edge: string, tick: number) =>
      log.announce({ type: 'RaidArrived', partyId: tick, kind, size: 9, tile: 0, edge } as unknown as GameEvent, w.readers, tick);
    expect(arrived('raid', 'n', 1)?.line.text).toBe('A Gloam raid has come from the north!');
    expect(arrived('raid', 'n', 1)?.line.severity).toBe('danger');
    expect(arrived('siege', 'e', 2)?.line.text).toBe('A Gloam siege has come from the east!');
    expect(arrived('bandits', 'w', 3)?.line.text).toBe('Hillfolk bandits have come from the west!');
    expect(arrived('thief', 'n', 4)).toBeNull();
  });
});

describe('T-635 a kill order on a shared tile takes the raider', () => {
  it('a dog fighting a gloam warrior on its tile: the order names the warrior', () => {
    const f = setup('t635-kill');
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    const tile = f.w.index(30, 30, z);
    f.w.spawnCreature('dog', tile, 'fortress');
    const warrior = f.w.spawnCreature('gloam_warrior', tile, 'hostile:gloam');
    f.screen.key(press('m'));
    f.screen.military.settingKill = true;
    f.screen.key(press('Enter'));
    const cur = { ...f.screen.ui.cursor! };
    const arrows = (n: number, plus: string, minus: string): void => {
      for (let k = 0; k < Math.abs(n); k += 1) f.screen.key(press(n > 0 ? plus : minus));
    };
    arrows(30 - cur.x, '→', '←');
    arrows(30 - cur.y, '↓', '↑');
    expect(f.screen.ui.cursor).toEqual({ x: 30, y: 30 });
    f.screen.key(press('Enter'));
    expect(f.sent.find((cmd) => cmd.type === 'SquadOrder')).toMatchObject({ order: { kind: 'kill', targetId: warrior } });
  });
});

describe('T-635 the reputation log says why', () => {
  it('each entry gives its reason in words and its date as the log writes it', () => {
    const { w } = setup('t635-rep');
    const ctx = ctxOf(w);
    expect(reputationEntryText(ctx, { delta: -50, reason: 'caravan_member_killed', tick: 0 })).toBe('-50 caravan member killed (Sp 1)');
    expect(reputationEntryText(ctx, { delta: 5, reason: 'yearly_drift', tick: 0 })).toBe('+5 a year passed (Sp 1)');
    expect(reputationEntryText(ctx, { delta: 1, reason: 'something_new', tick: 0 })).toBe('+1 other (Sp 1)');
  });
});

describe('T-635 the legend names the biome and counts one enemy', () => {
  it('"forest", never temperate_forest; "slew 1 enemy."', () => {
    const game = new HeadlessGame({ seed: 't635-legend', fortressName: 'Vein Delve' });
    const journal = { peakPopulation: () => 33, deepestZ: () => 26, kills: () => [{ name: 'Modi Veinbrow', count: 1 }, { name: 'Tova Darkcrown', count: 2 }] };
    const record = composeLegend(game, null, game.registry, journal, [], { kind: 'all_dead', lastName: 'Marr Hollowstone', lastCause: 'killed' });
    const spec = game.terrain?.reader().spec();
    expect(spec?.biome).toBeDefined();
    expect(record.biome).toBe(game.registry.table<{ id: string; name: string }>('biomes').byId(spec?.biome ?? '')?.name);
    expect(record.biome).not.toContain('_');
    const lines = legendLines(record, strings).join('\n');
    expect(lines).toContain('Modi Veinbrow slew 1 enemy.');
    expect(lines).toContain('Tova Darkcrown slew 2 enemies.');
  });
});

describe('T-635 a wave with one child', () => {
  it('says "1 of them a child"', () => {
    const { w } = setup('t635-wave');
    const log = announcer(w);
    const ids = Array.from({ length: 8 }, (_, k) => w.spawnDwarf({ at: w.index(10 + k, 12, z) }));
    const wave = { type: 'ImmigrantsArrived', ids, count: 8, children: 1, guaranteed: false } as unknown as GameEvent;
    expect(log.announce(wave, w.readers, 1)?.line.text).toBe('8 dwarves have come to join the hall, 1 of them a child. [u] lists them.');
  });
});
