/**
 * U-01: every failure says what and why (`docs/archive/ui-fixes/README.md` D-U4; UI audit §§ 4.1,
 * 4.3, Q3, Q4, Q5). Rejections reach the status row for `STATUS_HINT_SECONDS` and the log as an
 * alert with the command's focus; the reason names the cause where the command tells it; blocked
 * jobs and workshops name the missing item, its count and where it is made; buildings are named,
 * never numbered by entity id.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { GameEvent } from '@core/events';
import { TileKind } from '@core/map3d';
import { computeLayout } from '@render/cellbuffer';
import { STATUS_HINT_SECONDS } from '@ui/constants';
import { buildingName, commandFocus, filterText, jobBlockText, rejectionText, whereMade, workshopBlockText } from '@ui/messages';
import { blockedSummary } from '@ui/panels/jobs';
import type { PanelContext } from '@ui/panels/context';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, registry, strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers,
    registry: w.game.registry,
    strings,
    submit: (cmd) => w.submit(cmd),
    focusOn: () => {},
    look: () => {},
    openPanel: () => {},
    shiftClick: () => false,
  };
}

function screenOf(w: TestWorld, clock: { now: number }): FortressScreen {
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => w.submit(cmd),
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => clock.now,
  };
  return new FortressScreen(host, keymap, strings);
}

/** Run one tick and hand the screen the rejections it produced. */
function stepInto(w: TestWorld, screen: FortressScreen): GameEvent[] {
  const before = w.allEvents().length;
  w.step(1);
  const events = w.allEvents().slice(before);
  screen.onEvents(events);
  return events;
}

describe('U-01 rejections: status row for four seconds and the log as an alert (Q5, D-U4)', () => {
  it('a refused command shows its reason, logs an alert with the command focus, and clears after STATUS_HINT_SECONDS', () => {
    expect(STATUS_HINT_SECONDS).toBe(4);
    const w = new TestWorld({ seed: 'u01-reject', world: 'flat-test', embark: 'none' });
    const clock = { now: 1000 };
    const screen = screenOf(w, clock);
    const origin = w.index(20, 20, z);
    w.discover(origin);
    w.carve(origin, TileKind.Floor);
    w.submit({ type: 'PlaceBuilding', buildingType: 'door', origin, orientation: 0, materialChoice: 0, priority: 5 });
    stepInto(w, screen);
    expect(screen.statusRow2()).toBe('Refused: Door needs walls on two opposite sides');
    const line = screen.log.lines[screen.log.lines.length - 1];
    expect(line).toMatchObject({ severity: 'alert', text: 'Refused: Door needs walls on two opposite sides', focus: origin });
    clock.now += STATUS_HINT_SECONDS * 1000 - 1;
    expect(screen.statusRow2()).toContain('Refused');
    clock.now += 2;
    expect(screen.statusRow2()).not.toContain('Refused');
  });

  it('names what a not_found lost, by the command subject, and the per-command precondition', () => {
    const w = new TestWorld({ seed: 'u01-reject-2', world: 'flat-test', embark: 'none' });
    const screen = screenOf(w, { now: 0 });
    w.submit({ type: 'RemoveZone', zoneId: 99999 });
    stepInto(w, screen);
    expect(screen.statusRow2()).toBe('Refused: that zone no longer exists');
    const ctx = ctxOf(w);
    expect(rejectionText(ctx, { type: 'DesignateHarvest', tiles: [1] }, 'precondition_failed')).toBe('no ripe crops there');
    expect(rejectionText(ctx, { type: 'DeconstructBuilding', buildingId: 1 }, 'precondition_failed')).toBe('that building is not finished yet');
    expect(rejectionText(ctx, { type: 'CancelJob', jobId: 1 }, 'not_found')).toBe('that job is finished or gone');
    expect(rejectionText(ctx, { type: 'SetLabor', dwarfId: 1 }, 'not_found')).toBe('that dwarf is no longer here');
    expect(rejectionText(ctx, { type: 'UndoDesignation', tiles: [1] }, 'has_progress')).toBe('0 designations kept: work has begun there');
    // A reason without a specific line keeps its own `reject.<reason>`; no reason code reaches the screen.
    expect(rejectionText(ctx, { type: 'CreateSquad' }, 'member_limit')).toBe('the squad is full');
    expect(rejectionText(ctx, { type: 'CreateSquad' }, 'some_future_reason')).toBe('that cannot be done');
    expect(rejectionText(ctx, { type: 'PlaceBuilding' }, 'footprint_blocked')).toBe('something is already built here');
  });

  it('a command focus is its first tile, origin, zone tile, building or creature', () => {
    const w = new TestWorld({ seed: 'u01-focus', world: 'flat-test', embark: 'none' });
    const t = w.index(5, 6, z);
    expect(commandFocus(w.readers, { type: 'Designate', tiles: [t, t + 1] })).toBe(t);
    expect(commandFocus(w.readers, { type: 'PlaceBuilding', origin: t })).toBe(t);
    expect(commandFocus(w.readers, { type: 'DesignateStairwell', x: 5, y: 6, zTop: z, zBottom: z - 2 })).toBe(t);
    const dwarf = w.spawnDwarf({ at: t });
    expect(commandFocus(w.readers, { type: 'SetLabor', dwarfId: dwarf })).toBe(t);
    expect(commandFocus(w.readers, { type: 'CreateSquad' })).toBeUndefined();
  });
});

describe('U-01 blocked jobs and workshops name the item, count and maker (Q4, §4.3, S7)', () => {
  const items = registry.table<{ id: string }>('items');

  it('a missing input names the item and count, and the workshops that make it', () => {
    const w = new TestWorld({ seed: 'u01-jobs', world: 'flat-test', embark: 'none' });
    const ctx = ctxOf(w);
    const door = { type: items.index('door') };
    expect(filterText(registry, door, 1)).toBe('1 door');
    expect(filterText(registry, door, 2)).toBe('2 doors');
    const job = { type: registry.table('jobTypes').index('build'), blockedReason: 'missing_input', tool: null, inputs: [{ filter: door, count: 1, delivered: [] }] };
    const text = jobBlockText(ctx, job);
    expect(text.short).toBe('waiting: 1 door');
    expect(text.long).toBe(`waiting: 1 door — order at ${whereMade(registry, ['door'])}`);
    expect(text.long).toContain("a carpenter's workshop");
    expect(jobBlockText(ctx, { ...job, blockedReason: 'no_tool', tool: 'pick' }).short).toBe('waiting: a pick');
    expect(jobBlockText(ctx, { ...job, type: registry.table('jobTypes').index('dig'), blockedReason: 'no_worker' }).long).toBe('No one has Mining enabled: [l] labors.');
    for (const reason of ['workshop_suspended', 'no_magma', 'target_invalid', 'unreachable']) {
      const out = jobBlockText(ctx, { ...job, blockedReason: reason });
      expect(out.short).not.toContain('_');
      expect(out.long.length).toBeGreaterThan(out.short.length - 1);
    }
  });

  it('the jobs header breaks the blocked jobs down by reason', () => {
    const w = new TestWorld({ seed: 'u01-summary', world: 'flat-test', embark: 'none' });
    const blocked = (reason: string) => ({ state: 'blocked', blockedReason: reason }) as never;
    expect(blockedSummary(ctxOf(w), [blocked('unreachable'), blocked('missing_input'), blocked('unreachable')]))
      .toBe('Blocked: 2 no path, 1 missing items');
    expect(blockedSummary(ctxOf(w), [])).toBe('');
  });

  it('a workshop waiting line names its input, and fuel says where fuel is made', () => {
    const w = new TestWorld({ seed: 'u01-workshop', world: 'flat-test', embark: 'none' });
    const ctx = ctxOf(w);
    expect(workshopBlockText(ctx, 'waiting for raw_stone')).toBe('Waiting for stone (0 available)');
    expect(workshopBlockText(ctx, 'missing_input')).toContain('Needs fuel — order at a wood furnace');
    expect(workshopBlockText(ctx, 'workshop_suspended')).toBe('Suspended: [S-s] resume');
    expect(workshopBlockText(ctx, null)).toBe('');
  });

  it('buildings read as their content name and ordinal, never an entity id (Q3)', () => {
    const w = new TestWorld({ seed: 'u01-names', world: 'flat-test', embark: 'none' });
    for (let x = 10; x <= 20; x += 1) for (let y = 10; y <= 14; y += 1) { w.discover(w.index(x, y, z)); w.carve(w.index(x, y, z), TileKind.Floor); }
    const first = w.build('carpenter', w.index(11, 11, z));
    const second = w.build('carpenter', w.index(16, 11, z));
    expect(buildingName(ctxOf(w), first)).toBe("Carpenter's workshop #1");
    expect(buildingName(ctxOf(w), second)).toBe("Carpenter's workshop #2");
    expect(buildingName(ctxOf(w), second)).not.toContain(String(second));
  });
});
