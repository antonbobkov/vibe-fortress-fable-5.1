/**
 * T-637: the first key after a danger line acts (only `Space` merely dismisses it), a fight
 * is one refreshed engagement line in the Alerts tab while its blows are the Combat tab's notes, a
 * fortress dwarf's death by a creature is one line, and a blow that does no damage says so
 * (24 § Announcements and the log, 16 § Combat log; `reports/audits/2026-11-19-t635-midgame-ux.md`,
 * findings 2, 7 and 8).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog, lineText, type LogLine } from '@ui/announcements';
import { LOG_ENGAGEMENT_TICKS } from '@ui/constants';
import { drawLogStrip, filterLines } from '@ui/panels/log';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { Speed } from '@ui/status';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ui = defaultUiState(z);
  let speed: Speed = 0;
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui, submit: (cmd) => w.submit(cmd),
    speed: () => speed, setSpeed: (s) => { speed = s; }, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => LAYOUT, precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
  };
  const screen = new FortressScreen(host, keymap, strings);
  return { w, ui, screen, speed: () => speed, setSpeed: (s: Speed) => { speed = s; } };
}

function blow(attackerId: number, defenderId: number, amount = 5): GameEvent {
  return { type: 'AttackResolved', attackerId, defenderId, part: 'torso', damageType: 'edge', amount, outcome: 'hit' } as unknown as GameEvent;
}

const DANGER: LogLine = { tick: 0, severity: 'danger', text: 'Halvar Ironfell has been killed by a hillfolk bandit.', count: 1 };

describe('T-637 the first key after a danger line acts', () => {
  it('a danger pinned, `m` dismisses it and opens Military', () => {
    const { ui, screen } = setup('t637-key-m');
    screen.pinned = DANGER;
    expect(screen.key(press('m'))).toBe(true);
    expect(screen.pinned).toBeNull();
    expect(ui.panel).toBe('military');
  });

  it('`Space` only dismisses: the game stays paused until the next `Space`', () => {
    const { screen, speed } = setup('t637-key-space');
    screen.pinned = DANGER;
    expect(screen.key(press('Space'))).toBe(true);
    expect(screen.pinned).toBeNull();
    expect(speed()).toBe(0);
    screen.key(press('Space'));
    expect(speed()).not.toBe(0);
  });

  it('`Esc` dismisses and backs out: the open panel closes (T-768)', () => {
    const { ui, screen } = setup('t637-key-esc');
    screen.key(press('m'));
    expect(ui.panel).toBe('military');
    screen.pinned = DANGER;
    expect(screen.key(press('Escape'))).toBe(true);
    expect(screen.pinned).toBeNull();
    expect(ui.panel).toBeNull();
  });

  it('a raid line pinned by the event, then `a` opens the log', () => {
    const { w, ui, screen } = setup('t637-key-raid');
    screen.onEvents([{ type: 'RaidArrived', partyId: 1, kind: 'raid', faction: 'hostile:gloam', count: 5, edge: 'west', tile: w.index(0, 10, z) } as unknown as GameEvent]);
    expect(screen.pinned?.severity).toBe('danger');
    screen.key(press('a'));
    expect(screen.pinned).toBeNull();
    expect(ui.panel).toBe('log');
  });
});

describe('T-637 a fight is one engagement line in the Alerts tab, its blows the Combat tab\'s', () => {
  function raid(seed: string) {
    const f = setup(seed);
    const { w } = f;
    const dwarves = ['Halvar Ironfell', 'Asa Forgehall', 'Liv Hammerfall'].map((name, k) => w.spawnDwarf({ at: w.index(10 + k, 10, z), name }));
    const dog = w.spawnCreature('dog', w.index(13, 10, z), 'fortress');
    const warriors = [10, 11, 12, 13].map((x) => w.spawnCreature('gloam_warrior', w.index(x, 11, z), 'hostile:gloam'));
    const archer = w.spawnCreature('gloam_archer', w.index(14, 12, z), 'hostile:gloam');
    return { ...f, dwarves, dog, warriors, archer };
  }

  it('a raid of several pairs makes one Alerts line, refreshed, and many Combat lines', () => {
    const { screen, dwarves, dog, warriors, archer } = raid('t637-raid');
    const [a, b, c] = dwarves as [number, number, number];
    const [w1, w2, w3, w4] = warriors as [number, number, number, number];
    const blows = [blow(w1, a), blow(a, w1, 7), blow(w2, b), blow(b, w2, 4), blow(w3, c), blow(dog, w4, 2), blow(w4, dog, 3), blow(archer, a, 13), blow(c, w3, 9)];
    blows.forEach((event, k) => screen.onEvents([{ ...event, amount: 1 + k } as GameEvent]));
    const lines = screen.log.lines;
    const alerts = filterLines(lines, 1);
    expect(alerts).toHaveLength(1);
    expect(lineText(alerts[0]!, strings)).toBe('! 3 dwarves and a dog are fighting 4 gloam warriors and a gloam archer.');
    expect(alerts[0]?.category).toBe('combat');
    // Nine blows, each a note of the Combat tab, and the engagement line.
    const combat = filterLines(lines, 2);
    expect(combat).toHaveLength(10);
    expect(combat.filter((l) => l.severity === 'note')).toHaveLength(9);
    // The All tab and the strip leave the blows out.
    expect(filterLines(lines, 0)).toEqual(alerts);
    const s = surface(80, 3);
    drawLogStrip(s, { col: 0, row: 0, cols: 80, rows: 3 }, lines, null, false, strings);
    expect(s.lines().filter((row) => row.includes('hits'))).toEqual([]);
    expect(s.lines()[2]).toContain('! 3 dwarves and a dog are fighting');
  });

  it('the line keeps its place and takes the latest blow\'s time; after a quiet of LOG_ENGAGEMENT_TICKS a blow opens a new line', () => {
    const { w, dwarves, warriors } = raid('t637-quiet');
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const [a] = dwarves as [number];
    const [w1, w2] = warriors as [number, number];
    expect(log.engage(blow(w1, a), w.readers, 10)?.severity).toBe('alert');
    expect(log.engage(blow(a, w2), w.readers, 10 + LOG_ENGAGEMENT_TICKS)).toBeNull();
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]?.text).toBe('Halvar Ironfell is fighting 2 gloam warriors.');
    expect(log.lines[0]?.tick).toBe(10 + LOG_ENGAGEMENT_TICKS);
    const again = log.engage(blow(w1, a), w.readers, 11 + 2 * LOG_ENGAGEMENT_TICKS);
    expect(again?.line.text).toBe('Halvar Ironfell is fighting a gloam warrior.');
    expect(log.lines).toHaveLength(2);
  });

  it('no engagement for a hunt, nor for a fight with no fortress creature in it', () => {
    const { w, screen, dwarves, warriors } = raid('t637-not-ours');
    const [a] = dwarves as [number];
    const deer = w.spawnCreature('deer', w.index(20, 20, z), 'wild');
    const guard = w.spawnCreature('hillfolk_bandit', w.index(21, 20, z), 'trader:hillfolk');
    screen.onEvents([blow(a, deer), blow(guard, warriors[0] as number), blow(warriors[0] as number, guard)]);
    expect(filterLines(screen.log.lines, 1)).toEqual([]);
    expect(filterLines(screen.log.lines, 2)).toHaveLength(3);
  });

  it('a wild animal that attacks a dwarf is an engagement', () => {
    const { w, screen, dwarves } = raid('t637-wolf');
    const wolf = w.spawnCreature('wolf', w.index(20, 20, z), 'wild');
    const e = w.game.world.entities;
    e.add(wolf, C.Wild, { ...e.get(wolf, C.Wild)!, state: 'attack' });
    screen.onEvents([blow(dwarves[1] as number, wolf)]);
    expect(filterLines(screen.log.lines, 1).map((l) => l.text)).toEqual(['Asa Forgehall is fighting a wolf.']);
  });

  it('the combat log setting "off" lists no blows; the engagement line comes all the same', () => {
    const { screen, dwarves, warriors } = raid('t637-off');
    screen.settings.combatLog = 'off';
    screen.onEvents([blow(warriors[0] as number, dwarves[0] as number)]);
    expect(screen.log.lines.map((l) => lineText(l, strings))).toEqual(['! Halvar Ironfell is fighting a gloam warrior.']);
  });

  it('a hit that does no damage says so', () => {
    const { w, dwarves, archer } = raid('t637-harmless');
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    expect(log.announce(blow(archer, dwarves[0] as number, 0), w.readers, 1)?.line.text).toBe('A gloam archer hits Halvar but does no harm.');
    expect(log.announce(blow(archer, dwarves[0] as number, 13), w.readers, 2)?.line.text).toBe('A gloam archer hits Halvar: 13 edge.');
  });
});

describe('T-637 a dwarf\'s death by a raider is one line', () => {
  it('the danger line names the killer, is in the Combat tab, and the kill makes no line of its own', () => {
    const { w, screen } = setup('t637-death');
    const bandit = w.spawnCreature('hillfolk_bandit', w.index(10, 10, z), 'hostile:hillfolk');
    const dwarf = w.spawnDwarf({ at: w.index(11, 10, z), name: 'Halvar Ironfell' });
    const body = w.game.world.entities.get(dwarf, C.Body)!;
    w.game.world.emit({ type: 'DamageDealt', attackerId: bandit, defenderId: dwarf, part: 'torso', damageType: 'edge', amount: body.parts[1]!.maxHp * 4 });
    w.until((v) => v.events('KillRecorded').length > 0, 30);
    const events = w.allEvents().filter((e) => e.type === 'CreatureDied' || e.type === 'KillRecorded');
    expect(events.map((e) => e.type)).toEqual(['CreatureDied', 'KillRecorded']);
    screen.onEvents(events);
    const named = screen.log.lines.filter((l) => l.text.includes('Halvar'));
    expect(named.map((l) => lineText(l, strings))).toEqual(['!! Halvar Ironfell has been killed by a hillfolk bandit.']);
    expect(filterLines(screen.log.lines, 2)).toEqual(named);
  });

  it('a raider slain by a dwarf keeps its kill line in the Combat tab', () => {
    const { w } = setup('t637-raider-slain');
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const dwarf = w.spawnDwarf({ at: w.index(11, 10, z), name: 'Halvar Ironfell' });
    const bandit = w.spawnCreature('hillfolk_bandit', w.index(10, 10, z), 'hostile:hillfolk');
    const body = w.game.world.entities.get(bandit, C.Body)!;
    w.game.world.emit({ type: 'DamageDealt', attackerId: dwarf, defenderId: bandit, part: 'torso', damageType: 'edge', amount: body.parts[1]!.maxHp * 4 });
    w.until((v) => v.events('KillRecorded').length > 0, 30);
    for (const event of w.allEvents().filter((e) => e.type === 'CreatureDied' || e.type === 'KillRecorded')) log.announce(event, w.readers, 5);
    expect(filterLines(log.lines, 2).map((l) => l.text)).toEqual(['Halvar Ironfell has slain a hillfolk bandit.']);
  });
});
